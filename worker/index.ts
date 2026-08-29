import { sendPushNotification } from "./push";

export interface Env {
  TMDB_READ_ACCESS_TOKEN: string;
  ADMIN_API_TOKEN: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  DB: D1Database;
}

type SessionRow = {
  id: string;
  profile_id: string;
  expires_at: string;
};

type ProfileRow = {
  id: string;
  name: string;
  avatar: string | null;
  sort_order: number;
  created_at: string;
};

const SESSION_DURATION_MS =
  1000 * 60 * 60 * 24 * 30; // 30 days

// ==================================================
// PUSH NOTIFICATIONS - SEND TO PROFILE
// ==================================================

async function sendPushToProfile(
  env: Env,
  profileId: string,
  payload: { title: string; body: string; url?: string }
): Promise<{ sent: number; failed: number }> {
  console.log(
    "PUSH FUNCTION START",
    {
      profileId
    }
  );

  let subs;

try {
subs = await env.DB
  .prepare(`
  SELECT endpoint, p256dh, auth
FROM push_subscriptions
WHERE profile_id = ?
  `)
.bind(profileId)
.all<{
    endpoint: string;
    p256dh: string;
    auth: string;
  }>();
} catch (error) {
  console.error(
    "PUSH SUBSCRIPTIONS QUERY ERROR",
    error
  );

  throw error;
}

 if (subs.results.length === 0) {
  console.log(
    "PUSH SUBSCRIPTIONS FOUND",
    {
      profileId,
      count: 0
    }
  );

  return { sent: 0, failed: 0 };
}

console.log(
  "PUSH SUBSCRIPTIONS FOUND",
  {
    profileId,
    count: subs.results.length
  }
);

  const vapidKeys = {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };

  let sent = 0;
  let failed = 0;

  for (const sub of subs.results) {
    const ok = await sendPushNotification(
      {
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth
      },
      payload,
      vapidKeys
    );

    if (ok) {
      sent++;
    } else {
      failed++;

      await env.DB
        .prepare(
          `DELETE FROM push_subscriptions WHERE endpoint = ?`
        )
        .bind(sub.endpoint)
        .run();
    }
  }

  return { sent, failed };
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/sw.js") {
  return new Response(
    `self.addEventListener("push", event => {
      let data = {};

      try {
        data = event.data
          ? event.data.json()
          : {};
      } catch {
        data = {
          title: "Streamix",
          body: event.data
            ? event.data.text()
            : "You have a new notification."
        };
      }

      const title =
        data.title || "Streamix";

      const options = {
        body:
          data.body ||
          "You have a new notification.",
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        data: {
          url: data.url || "/"
        }
      };

      event.waitUntil(
        self.registration.showNotification(
          title,
          options
        )
      );
    });

    self.addEventListener(
      "notificationclick",
      event => {
        event.notification.close();

        const url =
          event.notification.data?.url ||
          "/";

        event.waitUntil(
          clients.matchAll({
            type: "window",
            includeUncontrolled: true
          }).then(clientList => {
            for (const client of clientList) {
              if ("focus" in client) {
                client.navigate(url);
                return client.focus();
              }
            }

            if (clients.openWindow) {
              return clients.openWindow(url);
            }
          })
        );
      }
    );`,
    {
      status: 200,
      headers: {
        "Content-Type":
          "application/javascript; charset=UTF-8",
        "Cache-Control":
          "no-cache"
      }
    }
  );
}

          
    // ==================================================
    // CORS
    // ==================================================

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods":
        "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const json = (
      data: unknown,
      status = 200
    ) => {
      return Response.json(data, {
        status,
        headers: corsHeaders
      });
    };

    // ==================================================
    // HELPERS
    // ==================================================

    const getAuthorizationToken = (): string | null => {
      const authorization =
        request.headers.get("Authorization");

      if (
        !authorization ||
        !authorization.startsWith("Bearer ")
      ) {
        return null;
      }

      return authorization.slice(7).trim() || null;
    };

    const getSession = async (): Promise<SessionRow | null> => {
      const token =
        getAuthorizationToken();

      if (!token) {
        return null;
      }

      const session =
        await env.DB
          .prepare(`
            SELECT
              id,
              profile_id,
              expires_at
            FROM sessions
            WHERE id = ?
          `)
          .bind(token)
          .first<SessionRow>();

      if (!session) {
        return null;
      }

      const expiresAt =
        new Date(
          session.expires_at
        ).getTime();

      if (
        !Number.isFinite(expiresAt) ||
        expiresAt <= Date.now()
      ) {
        await env.DB
          .prepare(`
            DELETE FROM sessions
            WHERE id = ?
          `)
          .bind(token)
          .run();

        return null;
      }

      return session;
    };

    const requireSession =
      async (): Promise<
        | {
            session: SessionRow;
            profileId: string;
          }
        | Response
      > => {
        const session =
          await getSession();

        if (!session) {
          return json(
            {
              error:
                "Unauthorized. Please log in."
            },
            401
          );
        }

        return {
          session,
          profileId:
            session.profile_id
        };
      };

    const requireAdmin =
      async (): Promise<
        | {
            session: SessionRow;
          }
        | Response
      > => {
        const session =
          await getSession();

        if (!session) {
          return json(
            {
              error:
                "Unauthorized. Please log in."
            },
            401
          );
        }

        if (
          session.profile_id !==
          "admin"
        ) {
          return json(
            {
              error:
                "Forbidden. Admin access required."
            },
            403
          );
        }

        return {
          session
        };
      };

    const hashPassword = async (
      password: string
    ): Promise<string> => {
      const data =
        new TextEncoder().encode(
          password
        );

      const hash =
        await crypto.subtle.digest(
          "SHA-256",
          data
        );

      return Array.from(
        new Uint8Array(hash)
      )
        .map(byte =>
          byte
            .toString(16)
            .padStart(2, "0")
        )
        .join("");
    };

    const createSession =
      async (
        profileId: string
      ): Promise<string> => {
        const sessionId =
          crypto.randomUUID();

        const expiresAt =
          new Date(
            Date.now() +
              SESSION_DURATION_MS
          ).toISOString();

        await env.DB
          .prepare(`
            INSERT INTO sessions (
              id,
              profile_id,
              expires_at
            )
            VALUES (?, ?, ?)
          `)
          .bind(
            sessionId,
            profileId,
            expiresAt
          )
          .run();

        return sessionId;
      };

    const getProfile = async (
      profileId: string
    ): Promise<ProfileRow | null> => {
      return env.DB
        .prepare(`
          SELECT
            id,
            name,
            avatar,
            sort_order,
            created_at
          FROM profiles
          WHERE id = ?
        `)
        .bind(profileId)
        .first<ProfileRow>();
    };

    // ==================================================
    // HEALTH CHECK
    // ==================================================

    if (
      url.pathname === "/api/health"
    ) {
      return json({
        status: "ok",
        service: "Streamix API",
        tmdbConfigured:
          Boolean(
            env.TMDB_READ_ACCESS_TOKEN
          ),
        databaseConfigured:
          Boolean(env.DB)
      });
    }

// ==================================================
// AUTH - TEST
// ==================================================

if (
  url.pathname === "/api/auth/test" &&
  request.method === "GET"
) {
  return json({
    success: true,
    message: "Streamix API is working"
  });
}


 // ==================================================
// AUTH - LOGIN
// ==================================================

if (
  url.pathname === "/api/auth/login" &&
  request.method === "POST"
) {
  try {
    const body =
      await request.json<{
        profileId?: string;
        password?: string;
      }>();

    const profileId =
      body.profileId?.trim();

    const password =
      body.password ?? "";

    if (!profileId) {
      return json(
        {
          error:
            "Profile id is required."
        },
        400
      );
    }

    const profile =
      await env.DB
        .prepare(`
          SELECT
            id,
            name,
            avatar,
            password_hash,
            sort_order,
            created_at,
            deleted_at
          FROM profiles
          WHERE id = ?
        `)
        .bind(profileId)
        .first<{
          id: string;
          name: string;
          avatar: string | null;
          password_hash: string | null;
          sort_order: number;
          created_at: string;
          deleted_at: string | null;
        }>();

    if (!profile) {
      return json(
        {
          error:
            "Profile not found."
        },
        404
      );
    }

    /*
     * DELETED PROFILE
     *
     * Deleted profiles remain in the database
     * so they can be restored later, but they
     * cannot be logged into while deleted.
     */
    if (profile.deleted_at) {
      return json(
        {
          error:
            "This profile has been deleted."
        },
        403
      );
    }

    /*
     * TESTING PROFILE
     *
     * The TESTING profile can only be accessed
     * by an authenticated Admin.
     *
     * It does not require a password.
     */
    if (
      profile.id === "testing"
    ) {
      const admin =
        await requireAdmin();

      if (admin instanceof Response) {
        return json(
          {
            error:
              "The TESTING profile is only available to Admin."
          },
          403
        );
      }

      const sessionId =
        await createSession(
          profile.id
        );

      return json({
        success: true,
        sessionId,
        profile: {
          id: profile.id,
          name: profile.name,
          avatar: profile.avatar
        }
      });
    }

     // ADMIN PASSWORD COMES ONLY FROM CLOUDFLARE

if (
  profile.id === "admin"
) {
  if (!env.ADMIN_API_TOKEN) {
    return json(
      {
        error:
          "ADMIN_API_TOKEN is not configured."
      },
      500
    );
  }

  if (
    password !==
    env.ADMIN_API_TOKEN
  ) {
    return json(
      {
        error:
          "Incorrect password."
      },
      401
    );
  }
} else {
  if (
    !profile.password_hash
  ) {
    return json({
      requiresPasswordSetup:
        true,
      profile: {
        id: profile.id,
        name: profile.name,
        avatar:
          profile.avatar
      }
    });
  }

  const passwordHash =
    await hashPassword(
      password
    );

  if (
    passwordHash !==
    profile.password_hash
  ) {
    return json(
      {
        error:
          "Incorrect password."
      },
      401
    );
  }
}

const sessionId =
  await createSession(
    profile.id
  );

return json({
  success: true,
  sessionId,
  profile: {
    id: profile.id,
    name: profile.name,
    avatar: profile.avatar
  }
});
} catch (error) {
  console.error(
    "AUTH LOGIN ERROR:",
    error
  );

  return json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Login server error."
    },
    500
  );
}
}
    
    // ==================================================
// AUTH - CURRENT SESSION
// ==================================================
if (
  url.pathname === "/api/auth/session" &&
  request.method === "GET"
) {
  const session =
    await getSession();

  if (!session) {
    return json(
      {
        authenticated: false
      },
      401
    );
  }

  const profile =
    await getProfile(
      session.profile_id
    );

  if (!profile) {
    return json(
      {
        authenticated: false
      },
      401
    );
  }

  return json({
    authenticated: true,
    profile: {
      id: profile.id,
      name: profile.name,
      avatar: profile.avatar
    }
  });
}
    
// ==================================================
// AUTH - RESTORE SESSION
// ==================================================
if (
  url.pathname === "/api/auth/session" &&
  request.method === "GET"
) {
  const session = await getSession();

  if (!session) {
    return json(
      {
        authenticated: false
      },
      401
    );
  }

  const profile =
    await getProfile(
      session.profile_id
    );

  if (!profile) {
    return json(
      {
        authenticated: false
      },
      401
    );
  }

  return json({
    authenticated: true,
    profile: {
      id: profile.id,
      name: profile.name,
      avatar: profile.avatar
    }
  });
}
      // ==================================================
    // AUTH - SET PASSWORD
    // ==================================================

    if (
      url.pathname === "/api/auth/set-password" &&
      request.method === "POST"
    ) {
      const body =
        await request.json<{
          profileId?: string;
          password?: string;
        }>();

      const profileId =
        body.profileId?.trim();

      const password =
        body.password ?? "";

      if (!profileId) {
        return json(
          {
            error:
              "Profile id is required."
          },
          400
        );
      }

      if (!password.trim()) {
        return json(
          {
            error:
              "Password is required."
          },
          400
        );
      }

      if (profileId === "admin") {
        return json(
          {
            error:
              "The Admin password is managed securely by Cloudflare."
          },
          403
        );
      }

      const profile =
        await env.DB
          .prepare(`
            SELECT
              id,
              password_hash
            FROM profiles
            WHERE id = ?
          `)
          .bind(profileId)
          .first<{
            id: string;
            password_hash: string | null;
          }>();

      if (!profile) {
        return json(
          {
            error:
              "Profile not found."
          },
          404
        );
      }

      /*
       * IMPORTANT:
       *
       * A profile may only initialize its password
       * when it does not already have one.
       *
       * Once a password exists, the profile must
       * authenticate before changing it.
       */

      if (profile.password_hash) {
        const session =
          await getSession();

        if (
          !session ||
          session.profile_id !==
            profileId
        ) {
          return json(
            {
              error:
                "Unauthorized."
            },
            401
          );
        }

        return json(
          {
            error:
              "This profile already has a password. Use change-password."
          },
          409
        );
      }

      const passwordHash =
        await hashPassword(
          password
        );

      await env.DB
        .prepare(`
          UPDATE profiles
          SET password_hash = ?
          WHERE id = ?
        `)
        .bind(
          passwordHash,
          profileId
        )
        .run();

      const sessionId =
        await createSession(
          profileId
        );

      return json({
        success: true,
        sessionId
      });
    }

    // ==================================================
    // AUTH - CHANGE PASSWORD
    // ==================================================

    if (
      url.pathname === "/api/auth/change-password" &&
      request.method === "POST"
    ) {
      const auth =
        await requireSession();

      if (auth instanceof Response) {
        return auth;
      }

      const body =
        await request.json<{
          currentPassword?: string;
          newPassword?: string;
        }>();

      const currentPassword =
        body.currentPassword ?? "";

      const newPassword =
        body.newPassword ?? "";

      if (!newPassword.trim()) {
        return json(
          {
            error:
              "New password is required."
          },
          400
        );
      }

      if (auth.profileId === "admin") {
        return json(
          {
            error:
              "The Admin password is managed securely by Cloudflare."
          },
          403
        );
      }

      const profile =
        await env.DB
          .prepare(`
            SELECT
              password_hash
            FROM profiles
            WHERE id = ?
          `)
          .bind(
            auth.profileId
          )
          .first<{
            password_hash: string | null;
          }>();

      if (!profile) {
        return json(
          {
            error:
              "Profile not found."
          },
          404
        );
      }

      if (!profile.password_hash) {
        return json(
          {
            error:
              "This profile does not have a password yet."
          },
          400
        );
      }

      const currentHash =
        await hashPassword(
          currentPassword
        );

      if (
        currentHash !==
        profile.password_hash
      ) {
        return json(
          {
            error:
              "Current password is incorrect."
          },
          401
        );
      }

      const newHash =
        await hashPassword(
          newPassword
        );

      await env.DB
        .prepare(`
          UPDATE profiles
          SET password_hash = ?
          WHERE id = ?
        `)
        .bind(
          newHash,
          auth.profileId
        )
        .run();

      return json({
        success: true
      });
    }

    // ==================================================
    // AUTH - ADMIN RESET PROFILE PASSWORD
    // ==================================================

    if (
      url.pathname ===
        "/api/auth/admin-reset-password" &&
      request.method === "POST"
    ) {
      const admin =
        await requireAdmin();

      if (admin instanceof Response) {
        return admin;
      }

      const body =
        await request.json<{
          profileId?: string;
          newPassword?: string;
        }>();

      const profileId =
        body.profileId?.trim();

      const newPassword =
        body.newPassword ?? "";

      if (!profileId) {
        return json(
          {
            error:
              "Profile id is required."
          },
          400
        );
      }

      if (!newPassword.trim()) {
        return json(
          {
            error:
              "New password is required."
          },
          400
        );
      }

      if (profileId === "admin") {
        return json(
          {
            error:
              "The Admin password must be changed in Cloudflare."
          },
          403
        );
      }

      const profile =
        await env.DB
          .prepare(`
            SELECT
              id
            FROM profiles
            WHERE id = ?
          `)
          .bind(profileId)
          .first<{
            id: string;
          }>();

      if (!profile) {
        return json(
          {
            error:
              "Profile not found."
          },
          404
        );
      }

      const passwordHash =
        await hashPassword(
          newPassword
        );

      await env.DB
        .prepare(`
          UPDATE profiles
          SET password_hash = ?
          WHERE id = ?
        `)
        .bind(
          passwordHash,
          profileId
        )
        .run();

      /*
       * Invalidate all existing sessions for
       * this profile after an Admin reset.
       */
      await env.DB
        .prepare(`
          DELETE FROM sessions
          WHERE profile_id = ?
        `)
        .bind(
          profileId
        )
        .run();

      return json({
        success: true
      });
    }


// ==================================================
// AUTH - RESTORE SESSION
// ==================================================

if (
  url.pathname === "/api/auth/session" &&
  request.method === "GET"
) {
  const auth = await requireSession();

  if (auth instanceof Response) {
    return auth;
  }

  const profile = await getProfile(
    auth.profileId
  );

  if (!profile) {
    return json(
      {
        authenticated: false
      },
      401
    );
  }

  return json({
    authenticated: true,
    profile: {
      id: profile.id,
      name: profile.name,
      avatar: profile.avatar
    }
  });
}

    // ==================================================
    // AUTH - LOGOUT
    // ==================================================

    if (
      url.pathname === "/api/auth/logout" &&
      request.method === "POST"
    ) {
      const token =
        getAuthorizationToken();

      if (token) {
        await env.DB
          .prepare(`
            DELETE FROM sessions
            WHERE id = ?
          `)
          .bind(token)
          .run();
      }

      return json({
        success: true
      });
    }

// ==================================================
// PROFILES - GET
// ==================================================

if (
  url.pathname === "/api/profiles" &&
  request.method === "GET"
) {
  /*
   * Make sure the TESTING profile exists.
   * It is intentionally created here so it is
   * available even if it does not already exist
   * in the database.
   */
  await env.DB
    .prepare(`
      INSERT OR IGNORE INTO profiles (
        id,
        name,
        avatar,
        sort_order
      )
      VALUES (
        'testing',
        'TESTING',
        '🧪',
        9998
      )
    `)
    .run();

  /*
   * Check whether the current request is from Admin.
   * Normal users are still allowed to load profiles,
   * but they will not receive the TESTING profile.
   */
  const session =
    await requireSession();

  const isAdmin =
    !(session instanceof Response) &&
    session.profileId === "admin";

  const result =
    await env.DB
      .prepare(`
        SELECT
          id,
          name,
          avatar,
          sort_order
        FROM profiles
        ${
          isAdmin
            ? "WHERE deleted_at IS NULL"
            : "WHERE deleted_at IS NULL AND id != 'testing'"
        }
        ORDER BY
          sort_order ASC,
          name ASC
      `)
      .all<{
        id: string;
        name: string;
        avatar: string | null;
        sort_order: number;
      }>();

  return json(
    result.results
  );
}

// ==================================================
// PROFILES - POST
// ==================================================

if (
  url.pathname === "/api/profiles" &&
  request.method === "POST"
) {
  const admin =
    await requireAdmin();

  if (admin instanceof Response) {
    return admin;
  }

  const body =
    await request.json<{
      id?: string;
      name?: string;
      avatar?: string;
      sort_order?: number;
    }>();

  const id =
    body.id ||
    crypto.randomUUID();

  const name =
    body.name?.trim() ||
    "New Profile";

  const avatar =
    body.avatar ||
    "🙂";

  const sortOrder =
    typeof body.sort_order ===
    "number"
      ? body.sort_order
      : 9999;

  await env.DB
    .prepare(`
      INSERT INTO profiles (
        id,
        name,
        avatar,
        sort_order
      )
      VALUES (?, ?, ?, ?)
    `)
    .bind(
      id,
      name,
      avatar,
      sortOrder
    )
    .run();

  const result =
    await getProfile(id);

  return json(
    result,
    201
  );
}


// ==================================================
// PROFILES - PUT
// ==================================================

if (
  url.pathname === "/api/profiles" &&
  request.method === "PUT"
) {
  const auth =
    await requireSession();

  if (auth instanceof Response) {
    return auth;
  }

  const body =
    await request.json<{
      id: string;
      name?: string;
      avatar?: string;
      sort_order?: number;
    }>();

  if (!body.id) {
    return json(
      {
        error:
          "Profile id is required."
      },
      400
    );
  }

  const isAdmin =
    auth.profileId ===
    "admin";

  if (
    !isAdmin &&
    body.id !==
      auth.profileId
  ) {
    return json(
      {
        error:
          "You can only edit your own profile."
      },
      403
    );
  }

  const existing =
    await env.DB
      .prepare(`
        SELECT
          id,
          name,
          avatar,
          sort_order
        FROM profiles
        WHERE id = ?
      `)
      .bind(body.id)
      .first<{
        id: string;
        name: string;
        avatar: string | null;
        sort_order: number;
      }>();

  if (!existing) {
    return json(
      {
        error:
          "Profile not found."
      },
      404
    );
  }

  const name =
    body.name !== undefined
      ? body.name.trim()
      : existing.name;

  const avatar =
    body.avatar !== undefined
      ? body.avatar
      : existing.avatar;

  /*
   * Only Admin can change profile order.
   */
  const sortOrder =
    isAdmin &&
    body.sort_order !==
      undefined
      ? body.sort_order
      : existing.sort_order;

  await env.DB
    .prepare(`
      UPDATE profiles
      SET
        name = ?,
        avatar = ?,
        sort_order = ?
      WHERE id = ?
    `)
    .bind(
      name,
      avatar,
      sortOrder,
      body.id
    )
    .run();

  const result =
    await getProfile(
      body.id
    );

  return json(result);
}


// ==================================================
// PROFILES - DELETE
// ==================================================

if (
  url.pathname === "/api/profiles" &&
  request.method === "DELETE"
) {
  const admin =
    await requireAdmin();

  if (admin instanceof Response) {
    return admin;
  }

  const id =
    url.searchParams.get("id");

  if (!id) {
    return json(
      {
        error:
          "Profile id is required."
      },
      400
    );
  }

  if (
    id === "admin" ||
    id === "testing"
  ) {
    return json(
      {
        error:
          "The admin and testing profiles cannot be deleted."
      },
      400
    );
  }

  await env.DB
    .prepare(`
      UPDATE profiles
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(id)
    .run();

  return json({
    success: true
  });
}


// ==================================================
// PROFILES - RESTORE
// ==================================================

if (
  url.pathname === "/api/profiles/restore" &&
  request.method === "POST"
) {
  const admin =
    await requireAdmin();

  if (admin instanceof Response) {
    return admin;
  }

  const id =
    url.searchParams.get("id");

  if (!id) {
    return json(
      {
        error:
          "Profile id is required."
      },
      400
    );
  }

  const result =
    await env.DB
      .prepare(`
        UPDATE profiles
        SET deleted_at = NULL
        WHERE id = ?
          AND deleted_at IS NOT NULL
      `)
      .bind(id)
      .run();

  if (
    !result.meta ||
    result.meta.changes === 0
  ) {
    return json(
      {
        error:
          "Deleted profile not found."
      },
      404
    );
  }

  return json({
    success: true
  });
}

    // ==================================================
// PROFILES - DELETED
// ==================================================

if (
  url.pathname === "/api/profiles/deleted" &&
  request.method === "GET"
) {
  const admin =
    await requireAdmin();

  if (admin instanceof Response) {
    return admin;
  }

  const result =
    await env.DB
      .prepare(`
        SELECT
          id,
          name,
          avatar,
          sort_order,
          created_at,
          deleted_at
        FROM profiles
        WHERE deleted_at IS NOT NULL
        ORDER BY
          deleted_at DESC
      `)
      .all<{
        id: string;
        name: string;
        avatar: string | null;
        sort_order: number;
        created_at: string;
        deleted_at: string;
      }>();

  return json(
    result.results
  );
}
    // ==================================================
    // LIBRARY - GET
    // ==================================================

    if (
      url.pathname === "/api/library" &&
      request.method === "GET"
    ) {
      const result =
        await env.DB
          .prepare(`
            SELECT
              id,
              tmdb_id,
              media_type,
              title,
              poster_path,
              backdrop_path,
              overview,
              release_date,
              vote_average,
              created_at
            FROM library_items
            ORDER BY
              title COLLATE NOCASE ASC
          `)
          .all();

      return json(
        result.results
      );
    }

    // ==================================================
    // LIBRARY - POST
    // ==================================================

    if (
      url.pathname === "/api/library" &&
      request.method === "POST"
    ) {
      const admin =
        await requireAdmin();

      if (admin instanceof Response) {
        return admin;
      }

      const body =
        await request.json<{
          id?: string;
          tmdb_id: number;
          media_type: string;
          title: string;
          poster_path?: string | null;
          backdrop_path?: string | null;
          overview?: string | null;
          release_date?: string | null;
          vote_average?: number | null;
        }>();

      if (
        body.tmdb_id ===
          undefined ||
        !body.media_type ||
        !body.title
      ) {
        return json(
          {
            error:
              "tmdb_id, media_type and title are required."
          },
          400
        );
      }

      const id =
        body.id ||
        "tmdb-" +
          body.media_type +
          "-" +
          String(
            body.tmdb_id
          );

      await env.DB
        .prepare(`
          INSERT INTO library_items (
            id,
            tmdb_id,
            media_type,
            title,
            poster_path,
            backdrop_path,
            overview,
            release_date,
            vote_average
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id)
          DO UPDATE SET
            tmdb_id = excluded.tmdb_id,
            media_type = excluded.media_type,
            title = excluded.title,
            poster_path = excluded.poster_path,
            backdrop_path = excluded.backdrop_path,
            overview = excluded.overview,
            release_date = excluded.release_date,
            vote_average = excluded.vote_average
        `)
        .bind(
          id,
          body.tmdb_id,
          body.media_type,
          body.title,
          body.poster_path ??
            null,
          body.backdrop_path ??
            null,
          body.overview ?? null,
          body.release_date ??
            null,
          body.vote_average ??
            null
        )
        .run();

      const result =
        await env.DB
          .prepare(`
            SELECT *
            FROM library_items
            WHERE id = ?
          `)
          .bind(id)
          .first();

      return json(
        result,
        201
      );
    }

    // ==================================================
// LIBRARY - ENSURE TMDB TITLE
// ==================================================

if (
  url.pathname ===
    "/api/library/ensure" &&
  request.method === "POST"
) {
  const auth =
    await requireSession();

  if (auth instanceof Response) {
    return auth;
  }

  const body =
    await request.json<{
      tmdb_id: number;
      media_type: "movie" | "tv";
      title: string;
      poster_path?: string | null;
      backdrop_path?: string | null;
      overview?: string | null;
      release_date?: string | null;
      vote_average?: number | null;
    }>();

  if (
    body.tmdb_id === undefined ||
    !body.media_type ||
    !body.title
  ) {
    return json(
      {
        error:
          "tmdb_id, media_type and title are required."
      },
      400
    );
  }

  const id =
    "tmdb-" +
    body.media_type +
    "-" +
    String(body.tmdb_id);

  await env.DB
    .prepare(`
      INSERT INTO library_items (
        id,
        tmdb_id,
        media_type,
        title,
        poster_path,
        backdrop_path,
        overview,
        release_date,
        vote_average
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id)
      DO UPDATE SET
        title = excluded.title,
        poster_path = excluded.poster_path,
        backdrop_path = excluded.backdrop_path,
        overview = excluded.overview,
        release_date = excluded.release_date,
        vote_average = excluded.vote_average
    `)
    .bind(
      id,
      body.tmdb_id,
      body.media_type,
      body.title,
      body.poster_path ?? null,
      body.backdrop_path ?? null,
      body.overview ?? null,
      body.release_date ?? null,
      body.vote_average ?? null
    )
    .run();

  const result =
    await env.DB
      .prepare(`
        SELECT *
        FROM library_items
        WHERE id = ?
      `)
      .bind(id)
      .first();

  return json(result);
}

// ==================================================
// TMDB - CATALOG
// ==================================================

if (
  url.pathname ===
    "/api/tmdb/catalog" &&
  request.method === "GET"
) {
  const auth =
    await requireSession();

  if (auth instanceof Response) {
    return auth;
  }

  if (!env.TMDB_READ_ACCESS_TOKEN) {
    return json(
      {
        error:
          "TMDB_READ_ACCESS_TOKEN is not configured."
      },
      500
    );
  }

  const page =
    Math.max(
      1,
      Number(
        url.searchParams.get(
          "page"
        ) || "1"
      )
    );

  const type =
    url.searchParams.get(
      "type"
    ) || "all";

  const resultsPerRequest = 40;
  const maxResults = 200;

  async function discover(
    mediaType:
      | "movie"
      | "tv"
  ) {
    const allResults: any[] = [];

    const currentYear =
      new Date().getFullYear();

    const dateParameter =
      mediaType === "movie"
        ? "primary_release_date"
        : "first_air_date";

    const sortParameter =
      mediaType === "movie"
        ? "primary_release_date.desc"
        : "first_air_date.desc";

    const firstTMDBPage =
      (page - 1) * 4 + 1;

    const lastTMDBPage =
      firstTMDBPage + 3;

    for (
      let tmdbPage = firstTMDBPage;
      tmdbPage <= lastTMDBPage;
      tmdbPage++
    ) {
      const response =
        await fetch(
          "https://api.themoviedb.org/3/discover/" +
            mediaType +
            "?include_adult=false" +
            "&include_video=false" +
            "&language=en-US" +
            "&with_original_language=en" +
            "&" +
            dateParameter +
            ".gte=" +
            currentYear +
            "-01-01" +
            "&" +
            dateParameter +
            ".lte=" +
            currentYear +
            "-12-31" +
            "&sort_by=" +
            sortParameter +
            "&page=" +
            tmdbPage,
          {
            headers: {
              Authorization:
                "Bearer " +
                env.TMDB_READ_ACCESS_TOKEN,
              accept:
                "application/json"
            }
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.status_message ===
          "string"
            ? data.status_message
            : "TMDB request failed."
        );
      }

      if (
        Array.isArray(
          data.results
        )
      ) {
        allResults.push(
          ...data.results
        );
      }

      if (
        !data.total_pages ||
        tmdbPage >=
          Number(
            data.total_pages
          )
      ) {
        break;
      }
    }

    return allResults;
  }

  try {
    let results: any[] = [];

    if (type === "movie") {
      results =
        await discover("movie");

      results =
        results.map(
          item => ({
            ...item,
            media_type:
              "movie"
          })
        );
    } else if (type === "tv") {
      results =
        await discover("tv");

      results =
        results.map(
          item => ({
            ...item,
            media_type:
              "tv"
          })
        );
    } else {
      const [
        movieResults,
        tvResults
      ] = await Promise.all([
        discover("movie"),
        discover("tv")
      ]);

      results = [
        ...movieResults.map(
          item => ({
            ...item,
            media_type:
              "movie"
          })
        ),
        ...tvResults.map(
          item => ({
            ...item,
            media_type:
              "tv"
          })
        )
      ];
    }

results =
  results.filter(
    item => {
      const title =
        item.media_type ===
        "tv"
          ? item.name || ""
          : item.title || "";

      return (
        item.original_language ===
          "en" &&
        /^[\x00-\x7F]*$/.test(
          title
        ) &&
        typeof item.poster_path ===
          "string" &&
        item.poster_path.trim() !== ""
      );
    }
  );

results =
  results.filter(
    (item, index, array) =>
      array.findIndex(
        existing =>
          existing.id ===
          item.id &&
          existing.media_type ===
          item.media_type
      ) === index
  );
    results =
      results.sort(
        (a, b) => {
          const aDate =
            a.media_type === "tv"
              ? a.first_air_date || ""
              : a.release_date || "";

          const bDate =
            b.media_type === "tv"
              ? b.first_air_date || ""
              : b.release_date || "";

          if (aDate !== bDate) {
            return bDate.localeCompare(
              aDate
            );
          }

          return (
            Number(
              b.popularity || 0
            ) -
            Number(
              a.popularity || 0
            )
          );
        }
      );

    results =
      results.slice(
        0,
        resultsPerRequest
      );

    const hasMore =
      results.length ===
        resultsPerRequest &&
      page * resultsPerRequest <
        maxResults;

    return json({
      page,
      total_pages:
        hasMore
          ? Math.ceil(
              maxResults /
                resultsPerRequest
            )
          : page,
      results
    });
  } catch (error) {
    console.error(
      "TMDB CATALOG ERROR:",
      error
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load TMDB catalog.",
        results: []
      },
      500
    );
  }
}
    
    // ==================================================
    // LIBRARY - DELETE
    // ==================================================

    if (
      url.pathname === "/api/library" &&
      request.method === "DELETE"
    ) {
      const admin =
        await requireAdmin();

      if (admin instanceof Response) {
        return admin;
      }

      const id =
        url.searchParams.get("id");

      if (!id) {
        return json(
          {
            error:
              "Library item id is required."
          },
          400
        );
      }

      await env.DB
        .prepare(`
          DELETE FROM library_items
          WHERE id = ?
        `)
        .bind(id)
        .run();

      return json({
        success: true
      });
    }

    // ==================================================
    // WATCH HISTORY - GET
    // ==================================================

    if (
      url.pathname ===
        "/api/watch-history" &&
      request.method === "GET"
    ) {
      const auth =
        await requireSession();

      if (auth instanceof Response) {
        return auth;
      }

      const requestedProfileId =
        url.searchParams.get(
          "profileId"
        );

      const profileId =
        auth.profileId === "admin" &&
        requestedProfileId
          ? requestedProfileId
          : auth.profileId;

      if (
        auth.profileId !== "admin" &&
        profileId !==
          auth.profileId
      ) {
        return json(
          {
            error:
              "Forbidden."
          },
          403
        );
      }

      const result =
        await env.DB
          .prepare(`
            SELECT
              library_item_id,
              watched_at
            FROM watch_history
            WHERE profile_id = ?
          `)
          .bind(profileId)
          .all();

      return json(
        result.results
      );
    }

    // ==================================================
    // WATCH HISTORY - POST
    // ==================================================

    if (
      url.pathname ===
        "/api/watch-history" &&
      request.method === "POST"
    ) {
      const auth =
        await requireSession();

      if (auth instanceof Response) {
        return auth;
      }

      const body =
        await request.json<{
          profileId: string;
          libraryItemId: string;
        }>();

      if (
        !body.profileId ||
        !body.libraryItemId
      ) {
        return json(
          {
            error:
              "profileId and libraryItemId are required."
          },
          400
        );
      }

      if (
        auth.profileId !==
          "admin" &&
        auth.profileId !==
          body.profileId
      ) {
        return json(
          {
            error:
              "Forbidden."
          },
          403
        );
      }

      await env.DB
        .prepare(`
          INSERT OR IGNORE INTO watch_history (
            id,
            profile_id,
            library_item_id
          )
          VALUES (?, ?, ?)
        `)
        .bind(
          crypto.randomUUID(),
          body.profileId,
          body.libraryItemId
        )
        .run();

      return json({
        success: true
      });
    }

    // ==================================================
    // WATCH HISTORY - DELETE
    // ==================================================

    if (
      url.pathname ===
        "/api/watch-history" &&
      request.method === "DELETE"
    ) {
      const auth =
        await requireSession();

      if (auth instanceof Response) {
        return auth;
      }

      const profileId =
        url.searchParams.get(
          "profileId"
        );

      const libraryItemId =
        url.searchParams.get(
          "libraryItemId"
        );

      if (
        !profileId ||
        !libraryItemId
      ) {
        return json(
          {
            error:
              "profileId and libraryItemId are required."
          },
          400
        );
      }

      if (
        auth.profileId !==
          "admin" &&
        auth.profileId !==
          profileId
      ) {
        return json(
          {
            error:
              "Forbidden."
          },
          403
        );
      }

      await env.DB
        .prepare(`
          DELETE FROM watch_history
          WHERE profile_id = ?
          AND library_item_id = ?
        `)
        .bind(
          profileId,
          libraryItemId
        )
        .run();

      return json({
        success: true
      });
    }

    // ==================================================
    // WATCHLIST - GET
    // ==================================================

    if (
      url.pathname === "/api/watchlist" &&
      request.method === "GET"
    ) {
      const auth =
        await requireSession();

      if (auth instanceof Response) {
        return auth;
      }

      const requestedProfileId =
        url.searchParams.get(
          "profileId"
        );

      const profileId =
        auth.profileId === "admin" &&
        requestedProfileId
          ? requestedProfileId
          : auth.profileId;

      const result =
        await env.DB
          .prepare(`
            SELECT
              library_item_id,
              status,
              created_at
            FROM watchlist
            WHERE profile_id = ?
          `)
          .bind(profileId)
          .all();

      return json(
        result.results
      );
    }

    // ==================================================
    // WATCHLIST - POST
    // ==================================================

    if (
      url.pathname === "/api/watchlist" &&
      request.method === "POST"
    ) {
      const auth =
        await requireSession();

      if (auth instanceof Response) {
        return auth;
      }

      const body =
        await request.json<{
          profileId: string;
          libraryItemId: string;
        }>();

      if (
        !body.profileId ||
        !body.libraryItemId
      ) {
        return json(
          {
            error:
              "profileId and libraryItemId are required."
          },
          400
        );
      }

      if (
        auth.profileId !==
          "admin" &&
        auth.profileId !==
          body.profileId
      ) {
        return json(
          {
            error:
              "Forbidden."
          },
          403
        );
      }

      await env.DB
        .prepare(`
          INSERT OR IGNORE INTO watchlist (
            id,
            profile_id,
            library_item_id,
            status
          )
          VALUES (?, ?, ?, 'watchlist')
        `)
        .bind(
          crypto.randomUUID(),
          body.profileId,
          body.libraryItemId
        )
        .run();

      return json({
        success: true
      });
    }

    // ==================================================
    // WATCHLIST - DELETE
    // ==================================================

    if (
      url.pathname === "/api/watchlist" &&
      request.method === "DELETE"
    ) {
      const auth =
        await requireSession();

      if (auth instanceof Response) {
        return auth;
      }

      const profileId =
        url.searchParams.get(
          "profileId"
        );

      const libraryItemId =
        url.searchParams.get(
          "libraryItemId"
        );

      if (
        !profileId ||
        !libraryItemId
      ) {
        return json(
          {
            error:
              "profileId and libraryItemId are required."
          },
          400
        );
      }

      if (
        auth.profileId !==
          "admin" &&
        auth.profileId !==
          profileId
      ) {
        return json(
          {
            error:
              "Forbidden."
          },
          403
        );
      }

      await env.DB
        .prepare(`
          DELETE FROM watchlist
          WHERE profile_id = ?
          AND library_item_id = ?
        `)
        .bind(
          profileId,
          libraryItemId
        )
        .run();

      return json({
        success: true
      });
    }

    // ==================================================
// REMINDERS - GET
// ==================================================

if (
  url.pathname === "/api/reminders" && request.method === "GET"
) {
  const auth =
    await requireSession();

  if (auth instanceof Response) {
    return auth;
  }

  const requestedProfileId =
    url.searchParams.get(
      "profileId"
    );

  const profileId =
    auth.profileId === "admin" &&
    requestedProfileId
      ? requestedProfileId
      : auth.profileId;

  console.log(
  "REMINDERS GET PROFILE:",
  auth.profileId
);
  
const reminderProfileId =
  requestedProfileId &&
  auth.profileId === "admin" &&
  requestedProfileId === "testing"
    ? "testing"
    : auth.profileId;

const result =
  await env.DB
.prepare(`
  SELECT
    r.id,
    r.profile_id,
    r.library_item_id,
    r.reminder_date,
    r.reminder_time,
    r.created_at,
    r.sent_at,
    l.title,
    l.poster_path
  FROM reminders r
  LEFT JOIN library_items l
    ON l.id = r.library_item_id
  WHERE r.profile_id = ?
    AND r.sent_at IS NULL
  ORDER BY
    r.reminder_date ASC,
    r.reminder_time ASC
`)
    .bind(
      reminderProfileId
    )
    .all();

  return json(
    result.results
  );
}

// ==================================================
// REMINDERS - POST
// ==================================================

if (
  url.pathname === "/api/reminders" &&
  request.method === "POST"
) {
  const auth =
    await requireSession();

  if (auth instanceof Response) {
    return auth;
  }

  const body =
    await request.json<{
      profileId: string;
      libraryItemId: string;
      reminderDate: string;
      reminderTime: string;
    }>();

  if (
    !body.profileId ||
    !body.libraryItemId ||
    !body.reminderDate ||
    !body.reminderTime
  ) {
    return json(
      {
        error:
          "profileId, libraryItemId, reminderDate and reminderTime are required."
      },
      400
    );
  }

  if (
    auth.profileId !== "admin" &&
    auth.profileId !== body.profileId
  ) {
    return json(
      {
        error:
          "Forbidden."
      },
      403
    );
  }

  const id =
    crypto.randomUUID();

  await env.DB
    .prepare(`
      INSERT INTO reminders (
        id,
        profile_id,
        library_item_id,
        reminder_date,
        reminder_time
      )
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(
      id,
      body.profileId,
      body.libraryItemId,
      body.reminderDate,
      body.reminderTime
    )
    .run();

  return json({
    success: true,
    id
  });
}

// ==================================================
// REMINDERS - DELETE
// ==================================================

if (
  url.pathname === "/api/reminders" &&
  request.method === "DELETE"
) {
  const auth =
    await requireSession();

  if (auth instanceof Response) {
    return auth;
  }

  const profileId =
    url.searchParams.get(
      "profileId"
    );

  const id =
    url.searchParams.get(
      "id"
    );

  if (
    !profileId ||
    !id
  ) {
    return json(
      {
        error:
          "profileId and id are required."
      },
      400
    );
  }

  if (
    auth.profileId !== "admin" &&
    auth.profileId !== profileId
  ) {
    return json(
      {
        error:
          "Forbidden."
      },
      403
    );
  }

  await env.DB
    .prepare(`
      DELETE FROM reminders
      WHERE id = ?
      AND profile_id = ?
    `)
    .bind(
      id,
      profileId
    )
    .run();

  return json({
    success: true
  });
}

    // ==================================================
// REMINDERS - PUT
// ==================================================

if (
  url.pathname === "/api/reminders" &&
  request.method === "PUT"
) {
  const auth =
    await requireSession();

  if (auth instanceof Response) {
    return auth;
  }

  const body =
    await request.json<{
      id?: string;
      profileId?: string;
      reminderDate?: string;
      reminderTime?: string;
    }>();

  const id =
    body.id?.trim();

  const profileId =
    body.profileId?.trim();

  const reminderDate =
    body.reminderDate?.trim();

  const reminderTime =
    body.reminderTime?.trim();

  if (
    !id ||
    !profileId ||
    !reminderDate ||
    !reminderTime
  ) {
    return json(
      {
        error:
          "id, profileId, reminderDate and reminderTime are required."
      },
      400
    );
  }

  if (
    auth.profileId !== "admin" &&
    auth.profileId !== profileId
  ) {
    return json(
      {
        error:
          "Forbidden."
      },
      403
    );
  }

  const existing =
    await env.DB
      .prepare(`
        SELECT
          id,
          profile_id
        FROM reminders
        WHERE id = ?
        AND profile_id = ?
      `)
      .bind(
        id,
        profileId
      )
      .first<{
        id: string;
        profile_id: string;
      }>();

  if (!existing) {
    return json(
      {
        error:
          "Reminder not found."
      },
      404
    );
  }

  await env.DB
    .prepare(`
      UPDATE reminders
      SET
        reminder_date = ?,
        reminder_time = ?
      WHERE id = ?
      AND profile_id = ?
    `)
    .bind(
      reminderDate,
      reminderTime,
      id,
      profileId
    )
    .run();

  return json({
    success: true
  });
}
    
    // ==================================================
    // REWATCH - GET
    // ==================================================

    if (
      url.pathname === "/api/rewatch" &&
      request.method === "GET"
    ) {
      const auth =
        await requireSession();

      if (auth instanceof Response) {
        return auth;
      }

      const requestedProfileId =
        url.searchParams.get(
          "profileId"
        );

      const profileId =
        auth.profileId === "admin" &&
        requestedProfileId
          ? requestedProfileId
          : auth.profileId;

      const result =
        await env.DB
          .prepare(`
            SELECT
              library_item_id,
              created_at
            FROM rewatch
            WHERE profile_id = ?
          `)
          .bind(profileId)
          .all();

      return json(
        result.results
      );
    }

    // ==================================================
    // REWATCH - POST
    // ==================================================

    if (
      url.pathname === "/api/rewatch" &&
      request.method === "POST"
    ) {
      const auth =
        await requireSession();

      if (auth instanceof Response) {
        return auth;
      }

      const body =
        await request.json<{
          profileId: string;
          libraryItemId: string;
        }>();

      if (
        auth.profileId !==
          "admin" &&
        auth.profileId !==
          body.profileId
      ) {
        return json(
          {
            error:
              "Forbidden."
          },
          403
        );
      }

      await env.DB
        .prepare(`
          INSERT OR IGNORE INTO rewatch (
            id,
            profile_id,
            library_item_id
          )
          VALUES (?, ?, ?)
        `)
        .bind(
          crypto.randomUUID(),
          body.profileId,
          body.libraryItemId
        )
        .run();

      return json({
        success: true
      });
    }

    // ==================================================
    // REWATCH - DELETE
    // ==================================================

    if (
      url.pathname === "/api/rewatch" &&
      request.method === "DELETE"
    ) {
      const auth =
        await requireSession();

      if (auth instanceof Response) {
        return auth;
      }

      const profileId =
        url.searchParams.get(
          "profileId"
        );

      const libraryItemId =
        url.searchParams.get(
          "libraryItemId"
        );

      if (
        !profileId ||
        !libraryItemId
      ) {
        return json(
          {
            error:
              "profileId and libraryItemId are required."
          },
          400
        );
      }

      if (
        auth.profileId !==
          "admin" &&
        auth.profileId !==
          profileId
      ) {
        return json(
          {
            error:
              "Forbidden."
          },
          403
        );
      }

      await env.DB
        .prepare(`
          DELETE FROM rewatch
          WHERE profile_id = ?
          AND library_item_id = ?
        `)
        .bind(
          profileId,
          libraryItemId
        )
        .run();

      return json({
        success: true
      });
    }

    // ==================================================
    // REMINDERS - GET
    // ==================================================

    if (
      url.pathname === "/api/reminders" && request.method === "GET"
    ) {
      const auth =
        await requireSession();

      if (auth instanceof Response) {
        return auth;
      }

      const result =
        await env.DB
          .prepare(`
            SELECT
              id,
              profile_id,
              library_item_id,
              reminder_date,
              reminder_time,
              created_at
            FROM reminders
            WHERE profile_id = ?
            ORDER BY
              reminder_date ASC,
              reminder_time ASC
          `)
          .bind(
            auth.profileId
          )
          .all();

      return json(
        result.results
      );
    }


    // ==================================================
    // SCHEDULED RECOMMENDATIONS - GET
    // ==================================================

    if (
      url.pathname ===
        "/api/scheduled-recommendations" &&
      request.method === "GET"
    ) {
      const admin =
        await requireAdmin();

      if (admin instanceof Response) {
        return admin;
      }

      const result =
        await env.DB
          .prepare(`
            SELECT
              id,
              profile_id,
              library_item_id,
              scheduled_date,
              scheduled_time,
              message,
              created_at
            FROM scheduled_recommendations
            ORDER BY
              scheduled_date ASC,
              scheduled_time ASC
          `)
          .all();

      return json(
        result.results
      );
    }

    // ==================================================
    // SCHEDULED RECOMMENDATIONS - POST
    // ==================================================

    if (
      url.pathname ===
        "/api/scheduled-recommendations" &&
      request.method === "POST"
    ) {
      const admin =
        await requireAdmin();

      if (admin instanceof Response) {
        return admin;
      }

      const body =
        await request.json<{
          profileId: string;
          libraryItemId: string;
          scheduledDate: string;
          scheduledTime: string;
          message?: string;
        }>();

      if (
        !body.profileId ||
        !body.libraryItemId ||
        !body.scheduledDate ||
        !body.scheduledTime
      ) {
        return json(
          {
            error:
              "profileId, libraryItemId, scheduledDate and scheduledTime are required."
          },
          400
        );
      }

      await env.DB
        .prepare(`
          INSERT INTO scheduled_recommendations (
            id,
            profile_id,
            library_item_id,
            scheduled_date,
            scheduled_time,
            message
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          crypto.randomUUID(),
          body.profileId,
          body.libraryItemId,
          body.scheduledDate,
          body.scheduledTime,
          body.message ||
            "How about this one?"
        )
        .run();

      return json({
        success: true
      }, 201);
    }

    // ==================================================
    // SCHEDULED RECOMMENDATIONS - DELETE
    // ==================================================

    if (
      url.pathname ===
        "/api/scheduled-recommendations" &&
      request.method === "DELETE"
    ) {
      const admin =
        await requireAdmin();

      if (admin instanceof Response) {
        return admin;
      }

      const id =
        url.searchParams.get("id");

      if (!id) {
        return json(
          {
            error:
              "Scheduled recommendation id is required."
          },
          400
        );
      }

      await env.DB
        .prepare(`
          DELETE FROM scheduled_recommendations
          WHERE id = ?
        `)
        .bind(id)
        .run();

      return json({
        success: true
      });
    }

    // ==================================================
    // HERO SETTINGS - GET
    // ==================================================

    if (
      url.pathname ===
        "/api/hero-settings" &&
      request.method === "GET"
    ) {
      const result =
        await env.DB
          .prepare(`
            SELECT
              id,
              library_item_id,
              position_x,
              position_y,
              updated_at
            FROM hero_settings
            WHERE id = 1
          `)
          .first();

      return json(
        result || {
          id: 1,
          library_item_id: null,
          position_x: 50,
          position_y: 50
        }
      );
    }

    // ==================================================
    // HERO SETTINGS - PUT
    // ==================================================

    if (
      url.pathname ===
        "/api/hero-settings" &&
      request.method === "PUT"
    ) {
      const admin =
        await requireAdmin();

      if (admin instanceof Response) {
        return admin;
      }

      const body =
        await request.json<{
          libraryItemId:
            | string
            | null;
          positionX: number;
          positionY: number;
        }>();

      await env.DB
        .prepare(`
          INSERT INTO hero_settings (
            id,
            library_item_id,
            position_x,
            position_y
          )
          VALUES (1, ?, ?, ?)
          ON CONFLICT(id)
          DO UPDATE SET
            library_item_id =
              excluded.library_item_id,
            position_x =
              excluded.position_x,
            position_y =
              excluded.position_y,
            updated_at =
              CURRENT_TIMESTAMP
        `)
        .bind(
          body.libraryItemId ??
            null,
          body.positionX ?? 50,
          body.positionY ?? 50
        )
        .run();

      return json({
        success: true
      });
    }

    // ==================================================
    // RECOMMENDATION STATUS
    // ==================================================

    if (
      url.pathname ===
        "/api/recommendation-status" &&
      request.method === "GET"
    ) {
      const auth =
        await requireSession();

      if (auth instanceof Response) {
        return auth;
      }

      const result =
        await env.DB
          .prepare(`
            SELECT
              profile_id,
              seen_at
            FROM recommendation_status
            WHERE profile_id = ?
          `)
          .bind(
            auth.profileId
          )
          .first();

      return json(
        result || {
          profile_id:
            auth.profileId,
          seen_at: null
        }
      );
    }

    if (
      url.pathname ===
        "/api/recommendation-status" &&
      request.method === "POST"
    ) {
      const auth =
        await requireSession();

      if (auth instanceof Response) {
        return auth;
      }

      await env.DB
        .prepare(`
          INSERT INTO recommendation_status (
            profile_id,
            seen_at
          )
          VALUES (?, CURRENT_TIMESTAMP)
          ON CONFLICT(profile_id)
          DO UPDATE SET
            seen_at =
              CURRENT_TIMESTAMP
        `)
        .bind(
          auth.profileId
        )
        .run();

      return json({
        success: true
      });
    }
// ==================================================
// TMDB - HIDE JUST ADDED
// ==================================================

if (
  url.pathname ===
    "/api/tmdb/just-added/hide" &&
  request.method === "POST"
) {
  const admin =
    await requireAdmin();

  if (admin instanceof Response) {
    return admin;
  }

  const body =
    await request.json<{
      tmdbId?: number;
      mediaType?: "movie" | "tv";
      titleData?: any;
    }>();

  if (
    !body.tmdbId ||
    !body.mediaType
  ) {
    return json(
      {
        error:
          "tmdbId and mediaType are required."
      },
      400
    );
  }

  await env.DB
    .prepare(`
      CREATE TABLE IF NOT EXISTS just_added_hidden (
        tmdb_id INTEGER NOT NULL,
        media_type TEXT NOT NULL,
        hidden_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (
          tmdb_id,
          media_type
        )
      )
    `)
    .run();

  try {
    await env.DB
      .prepare(`
        ALTER TABLE just_added_hidden
        ADD COLUMN title_data TEXT
      `)
      .run();
  } catch {
    // Column already exists.
  }

  await env.DB
    .prepare(`
      INSERT INTO just_added_hidden (
        tmdb_id,
        media_type,
        title_data
      )
      VALUES (?, ?, ?)
      ON CONFLICT (
        tmdb_id,
        media_type
      )
      DO UPDATE SET
        title_data =
          excluded.title_data
    `)
    .bind(
      body.tmdbId,
      body.mediaType,
      JSON.stringify(
        body.titleData || {}
      )
    )
    .run();

  return json({
    success: true
  });
}

// ==================================================
// TMDB - GET HIDDEN JUST ADDED
// ==================================================

if (
  url.pathname ===
    "/api/tmdb/just-added/hidden" &&
  request.method === "GET"
) {
  const admin =
    await requireAdmin();

  if (admin instanceof Response) {
    return admin;
  }

  await env.DB
    .prepare(`
      CREATE TABLE IF NOT EXISTS just_added_hidden (
        tmdb_id INTEGER NOT NULL,
        media_type TEXT NOT NULL,
        hidden_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (
          tmdb_id,
          media_type
        )
      )
    `)
    .run();

  try {
    await env.DB
      .prepare(`
        ALTER TABLE just_added_hidden
        ADD COLUMN title_data TEXT
      `)
      .run();
  } catch {
    // Column already exists.
  }

  const hidden =
    await env.DB
      .prepare(`
        SELECT
          tmdb_id,
          media_type,
          hidden_at,
          title_data
        FROM just_added_hidden
        WHERE title_data IS NOT NULL
          AND title_data != ''
          AND title_data != '{}'
        ORDER BY hidden_at DESC
      `)
      .all<{
        tmdb_id: number;
        media_type: "movie" | "tv";
        hidden_at: string;
        title_data: string;
      }>();

  const results: any[] = [];

  for (
    const item of hidden.results
  ) {
    try {
      const savedData =
        JSON.parse(
          item.title_data
        );

      results.push({
        ...savedData,

        id:
          savedData.id ||
          (
            "tmdb-" +
            item.media_type +
            "-" +
            String(
              item.tmdb_id
            )
          ),

        media_type:
          item.media_type,

        hidden_at:
          item.hidden_at
      });
    } catch (error) {
      console.error(
        "Failed to parse hidden title data:",
        error
      );
    }
  }

  return json({
    results
  });
}
    // ==================================================
// TMDB - SHOW HIDDEN JUST ADDED AGAIN
// ==================================================

if (
  url.pathname ===
    "/api/tmdb/just-added/show" &&
  request.method === "POST"
) {
  const admin =
    await requireAdmin();

  if (admin instanceof Response) {
    return admin;
  }

  const body =
    await request.json<{
      tmdbId?: number;
      mediaType?: "movie" | "tv";
    }>();

  if (
    !body.tmdbId ||
    !body.mediaType
  ) {
    return json(
      {
        error:
          "tmdbId and mediaType are required."
      },
      400
    );
  }

  await env.DB
    .prepare(`
      DELETE FROM just_added_hidden
      WHERE tmdb_id = ?
      AND media_type = ?
    `)
    .bind(
      body.tmdbId,
      body.mediaType
    )
    .run();

  return json({
    success: true
  });
}
    
// ==================================================
// TMDB - JUST ADDED
// ==================================================

if (
  url.pathname ===
    "/api/tmdb/just-added" &&
  request.method === "GET"
) {
  const auth =
    await requireSession();

  if (auth instanceof Response) {
    return auth;
  }

  if (!env.TMDB_READ_ACCESS_TOKEN) {
    return json(
      {
        error:
          "TMDB_READ_ACCESS_TOKEN is not configured."
      },
      500
    );
  }

  const today =
    new Date();

  const endDate =
    today
      .toISOString()
      .slice(0, 10);

  const startDate =
    new Date(today);

  startDate.setDate(
    startDate.getDate() - 30
  );

  const currentYear =
    today.getFullYear();

  const januaryFirst =
    new Date(
      currentYear,
      0,
      1
    );

  const effectiveStart =
    startDate < januaryFirst
      ? januaryFirst
      : startDate;

  const startDateString =
    effectiveStart
      .toISOString()
      .slice(0, 10);

async function discover(
  type: "movie" | "tv"
) {
  const dateFilter =
    type === "movie"
      ? "primary_release_date"
      : "first_air_date";

  const allResults: any[] = [];

  for (let page = 1; page <= 5; page++) {
    const tmdbUrl =
      "https://api.themoviedb.org/3/discover/" +
      type +
      "?include_adult=false" +
      "&include_video=false" +
      "&language=en-US" +
      "&with_original_language=en" +
      "&page=" +
      page +
      "&sort_by=" +
      dateFilter +
      ".desc" +
      "&" +
      dateFilter +
      ".gte=" +
      startDateString +
      "&" +
      dateFilter +
      ".lte=" +
      endDate;

    const response =
      await fetch(
        tmdbUrl,
        {
          headers: {
            Authorization:
              "Bearer " +
              env.TMDB_READ_ACCESS_TOKEN,
            accept:
              "application/json"
          }
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        typeof data?.status_message ===
        "string"
          ? data.status_message
          : "TMDB request failed."
      );
    }

    if (
      Array.isArray(
        data.results
      )
    ) {
      allResults.push(
        ...data.results.filter(
          (item: any) => {
            const title =
              type === "movie"
                ? item.title || ""
                : item.name || "";

            const isEnglishOriginal =
              item.original_language ===
              "en";

            const hasOnlyLatinCharacters =
              /^[\x00-\x7F]*$/.test(
                title
              );

            return (
              isEnglishOriginal &&
              hasOnlyLatinCharacters
            );
          }
        )
      );
    }

    if (
      !data.total_pages ||
      page >= data.total_pages
    ) {
      break;
    }
  }

  return allResults;
}

  try {
    const [
      movies,
      tvShows
    ] = await Promise.all([
      discover("movie"),
      discover("tv")
    ]);

    await env.DB
      .prepare(`
        CREATE TABLE IF NOT EXISTS just_added_hidden (
          tmdb_id INTEGER NOT NULL,
          media_type TEXT NOT NULL,
          hidden_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (
            tmdb_id,
            media_type
          )
        )
      `)
      .run();

    const hidden =
      await env.DB
        .prepare(`
          SELECT
            tmdb_id,
            media_type
          FROM just_added_hidden
        `)
        .all<{
          tmdb_id: number;
          media_type: "movie" | "tv";
        }>();

    const hiddenKeys =
      new Set(
        hidden.results.map(
          item =>
            `${item.media_type}-${item.tmdb_id}`
        )
      );

    const results = [
      ...movies.map(
        (item: any) => ({
          ...item,
          media_type:
            "movie"
        })
      ),
      ...tvShows.map(
        (item: any) => ({
          ...item,
          media_type:
            "tv"
        })
      )
    ]
      .filter(
        (item: any) =>
          !hiddenKeys.has(
            `${item.media_type}-${item.id}`
          )
      )
      .sort(
        (a, b) => {
          const aDate =
            a.media_type ===
            "movie"
              ? a.release_date
              : a.first_air_date;

          const bDate =
            b.media_type ===
            "movie"
              ? b.release_date
              : b.first_air_date;

          return String(
            bDate || ""
          ).localeCompare(
            String(aDate || "")
          );
        }
      );

    return json({
      results
    });
  } catch (error) {
    console.error(
      "TMDB JUST ADDED ERROR:",
      error
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Just Added titles.",
        results: []
      },
      500
    );
  }
}
    
// ==================================================
// TMDB SEARCH
// ==================================================

if (
  url.pathname ===
    "/api/tmdb/search" &&
  request.method === "GET"
) {
  const auth =
    await requireSession();

  if (auth instanceof Response) {
    return auth;
  }

  const query =
    url.searchParams
      .get("query")
      ?.trim() || "";

  const type =
    url.searchParams.get(
      "type"
    ) || "multi";

  if (!query) {
    return json(
      {
        results: []
      },
      400
    );
  }

  if (
    !env.TMDB_READ_ACCESS_TOKEN
  ) {
    return json(
      {
        error:
          "TMDB_READ_ACCESS_TOKEN is not configured."
      },
      500
    );
  }

  const allowedTypes = [
    "multi",
    "movie",
    "tv"
  ];

  if (
    !allowedTypes.includes(
      type
    )
  ) {
    return json(
      {
        error:
          "Invalid TMDB search type."
      },
      400
    );
  }

  const tmdbUrl =
    "https://api.themoviedb.org/3/search/" +
    encodeURIComponent(type) +
    "?query=" +
    encodeURIComponent(query) +
    "&include_adult=false";

  const tmdbResponse =
    await fetch(
      tmdbUrl,
      {
        headers: {
          Authorization:
            "Bearer " +
            env.TMDB_READ_ACCESS_TOKEN,
          Accept:
            "application/json"
        }
      }
    );

  const data =
    await tmdbResponse.json();

  if (!tmdbResponse.ok) {
    return json(
      {
        error:
          "TMDB search failed."
      },
      tmdbResponse.status
    );
  }

  return json(data);
}

    // ==================================================
// TMDB DETAILS
// ==================================================

if (
  url.pathname ===
    "/api/tmdb/details" &&
  request.method === "GET"
) {
  const auth =
    await requireSession();

  if (auth instanceof Response) {
    return auth;
  }

  const type =
    url.searchParams.get(
      "type"
    );

  const id =
    url.searchParams.get(
      "id"
    );

  if (
    type !== "movie" &&
    type !== "tv"
  ) {
    return json(
      {
        error:
          "Invalid TMDB media type."
      },
      400
    );
  }

  if (!id) {
    return json(
      {
        error:
          "TMDB id is required."
      },
      400
    );
  }

  if (
    !/^\d+$/.test(id)
  ) {
    return json(
      {
        error:
          "Invalid TMDB id."
      },
      400
    );
  }

  if (
    !env.TMDB_READ_ACCESS_TOKEN
  ) {
    return json(
      {
        error:
          "TMDB_READ_ACCESS_TOKEN is not configured."
      },
      500
    );
  }

  const tmdbUrl =
    "https://api.themoviedb.org/3/" +
    type +
    "/" +
    encodeURIComponent(id) +
    "?language=en-US" +
    "&append_to_response=credits,videos,keywords,external_ids,recommendations,images,watch/providers";

  try {
    const tmdbResponse =
      await fetch(
        tmdbUrl,
        {
          headers: {
            Authorization:
              "Bearer " +
              env.TMDB_READ_ACCESS_TOKEN,
            Accept:
              "application/json"
          }
        }
      );

    const data =
      await tmdbResponse.json();

    if (!tmdbResponse.ok) {
      console.error(
        "TMDB DETAILS ERROR:",
        {
          status:
            tmdbResponse.status,
          type,
          id,
          data
        }
      );

      return json(
        {
          error:
            typeof data?.status_message ===
            "string"
              ? data.status_message
              : "TMDB details request failed."
        },
        tmdbResponse.status
      );
    }

    return json(data);
  } catch (error) {
    console.error(
      "TMDB DETAILS FETCH ERROR:",
      error
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load TMDB details."
      },
      500
    );
  }
}
    
// ==================================================
// PUSH NOTIFICATIONS - SUBSCRIBE
// ==================================================

if (
  url.pathname === "/api/push/subscribe" &&
  request.method === "POST"
) {
  const auth =
    await requireSession();

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body =
      await request.json<{
        subscription?: {
          endpoint?: string;
          keys?: {
            p256dh?: string;
            auth?: string;
          };
        };
        profileId?: string;
      }>();

    const endpoint =
      body.subscription?.endpoint?.trim();

    const p256dh =
      body.subscription?.keys?.p256dh?.trim();

    const authKey =
      body.subscription?.keys?.auth?.trim();

    if (
      !endpoint ||
      !p256dh ||
      !authKey
    ) {
      return json(
        {
          error:
            "Invalid push subscription."
        },
        400
      );
    }

    console.log(
      "PUSH SUBSCRIPTION SAVING",
      {
        authProfileId: auth.profileId,
        requestedProfileId:
          body.profileId,
        profileId:
          body.profileId ||
          auth.profileId,
        endpoint
      }
    );

    await env.DB
      .prepare(`
        INSERT INTO push_subscriptions (
          endpoint,
          profile_id,
          p256dh,
          auth
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(endpoint)
        DO UPDATE SET
          profile_id = excluded.profile_id,
          p256dh = excluded.p256dh,
          auth = excluded.auth
      `)
      .bind(
        endpoint,
        body.profileId ||
          auth.profileId,
        p256dh,
        authKey
      )
      .run();

    return json({
      success: true
    });
  } catch (error) {
    console.error(
      "PUSH SUBSCRIBE ERROR:",
      error
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : String(error)
      },
      500
    );
  }
}

// ==================================================
// PUSH NOTIFICATIONS - TEST
// ==================================================

if (
  url.pathname === "/api/push/test" &&
  request.method === "POST"
) {
  const auth =
    await requireSession();

  if (auth instanceof Response) {
    return auth;
  }

  if (auth.profileId !== "admin") {
    return json(
      {
        error: "Admin access required."
      },
      403
    );
  }

  try {
    const subscriptions =
      await env.DB
        .prepare(`
          SELECT
            endpoint,
            p256dh,
            auth
          FROM push_subscriptions
        `)
        .all<{
          endpoint: string;
          p256dh: string;
          auth: string;
        }>();

    const vapidKeys = {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT,
    };

    const results = {
      attempted: 0,
      sent: 0,
      removed: 0
    };

    for (
      const subscription
      of subscriptions.results
    ) {
      results.attempted++;

      const success =
        await sendPushNotification(
          {
            endpoint: subscription.endpoint,
            p256dh: subscription.p256dh,
            auth: subscription.auth
          },
          {
            title: "Streamix",
            body: "Push notifications are working!",
            url: "/"
          },
          vapidKeys
        );

      if (success) {
        results.sent++;
      } else {
        results.removed++;

        await env.DB
          .prepare(
            `DELETE FROM push_subscriptions
             WHERE endpoint = ?`
          )
          .bind(subscription.endpoint)
          .run();
      }
    }

    return json({
      success: true,
      results
    });
  } catch (error) {
    console.error(
      "PUSH TEST ERROR:",
      error
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Push test failed."
      },
      500
    );
  }
}
    
// ==================================================
// PUSH NOTIFICATIONS - UNSUBSCRIBE
// ==================================================

if (
  url.pathname === "/api/push/subscribe" &&
  request.method === "DELETE"
) {
  const auth =
    await requireSession();

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body =
      await request.json<{
        endpoint?: string;
      }>();

    const endpoint =
      body.endpoint?.trim();

    if (!endpoint) {
      return json(
        {
          error:
            "Push subscription endpoint is required."
        },
        400
      );
    }

    await env.DB
      .prepare(`
        DELETE FROM push_subscriptions
        WHERE endpoint = ?
        AND profile_id = ?
      `)
      .bind(
        endpoint,
        auth.profileId
      )
      .run();

    return json({
      success: true
    });
  } catch (error) {
    console.error(
      "PUSH UNSUBSCRIBE ERROR:",
      error
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to remove push subscription."
      },
      500
    );
  }
}


// ==================================================
// NOT FOUND
// ==================================================

return json(
  {
    error:
      "Route not found."
  },
  404
);
  },

   async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
   console.log("CRON FIRED", new Date().toISOString());
     const now = new Date();

    // Use Toronto time for scheduled reminders
    const torontoTime = new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "America/Toronto",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }
    ).formatToParts(now);

    const getPart = (type: string) =>
      torontoTime.find(
        part => part.type === type
      )?.value || "";

    const today =
      `${getPart("year")}-${getPart("month")}-${getPart("day")}`;

    const currentTime =
      `${getPart("hour")}:${getPart("minute")}`;

     console.log(
  "REMINDER TIME CHECK",
  {
    today,
    currentTime
  }
);

    // ==================================================
    // PROCESS DUE REMINDERS
    // ==================================================

    const dueReminders =
      await env.DB
        .prepare(`
          SELECT
            r.id,
            r.profile_id,
            r.library_item_id,
            r.reminder_date,
            r.reminder_time,
            l.title
          FROM reminders r
          JOIN library_items l
            ON l.id = r.library_item_id
          WHERE r.sent_at IS NULL
            AND (
              r.reminder_date < ?
              OR (
                r.reminder_date = ?
                AND r.reminder_time <= ?
              )
            )
        `)
        .bind(
          today,
          today,
          currentTime
        )
        .all<{
          id: string;
          profile_id: string;
          library_item_id: string;
          reminder_date: string;
          reminder_time: string;
          title: string;
               }>();

    console.log(
      "DUE REMINDERS",
      dueReminders.results
    );

   for (
  const reminder of dueReminders.results
) {
  const pushResult =
    await sendPushToProfile(
      env,
      reminder.profile_id,
      {
        title: "Streamix Reminder",
        body:
          `Time to watch ${reminder.title}!`,
        url: "/"
      }
    );

  console.log(
    "PUSH RESULT",
    {
      reminderId: reminder.id,
      profileId: reminder.profile_id,
      result: pushResult
    }
  );

      await env.DB
        .prepare(
          `UPDATE reminders
           SET sent_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(reminder.id)
        .run();
    }

    // ==================================================
    // PROCESS DUE SCHEDULED RECOMMENDATIONS
    // ==================================================

    try {
      await env.DB
        .prepare(
          `ALTER TABLE scheduled_recommendations ADD COLUMN sent_at TEXT`
        )
        .run();
    } catch {
      // Column already exists
    }

    const dueScheduled =
      await env.DB
        .prepare(`
          SELECT
            s.id,
            s.profile_id,
            s.library_item_id,
            s.message,
            s.scheduled_date,
            s.scheduled_time,
            l.title
          FROM scheduled_recommendations s
          JOIN library_items l
            ON l.id = s.library_item_id
          WHERE s.sent_at IS NULL
            AND (
              s.scheduled_date < ?
              OR (
                s.scheduled_date = ?
                AND s.scheduled_time <= ?
              )
            )
        `)
        .bind(
          today,
          today,
          currentTime
        )
        .all<{
          id: string;
          profile_id: string;
          library_item_id: string;
          message: string;
          scheduled_date: string;
          scheduled_time: string;
          title: string;
        }>();

    for (
      const scheduled of dueScheduled.results
    ) {
      await sendPushToProfile(
        env,
        scheduled.profile_id,
        {
          title:
            "Streamix Recommendation",
          body:
            `${scheduled.message}: ${scheduled.title}`,
          url: "/"
        }
      );

      await env.DB
        .prepare(
          `UPDATE scheduled_recommendations
           SET sent_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(scheduled.id)
        .run();
    }
  }
};
