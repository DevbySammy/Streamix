typescript
export interface Env {
  TMDB_READ_ACCESS_TOKEN: string;
  ADMIN_API_TOKEN: string;
  DB: D1Database;
} 

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);

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
    // ADMIN AUTHENTICATION
    // ==================================================

    const requireAdmin = (): Response | null => {
      const authorization =
        request.headers.get("Authorization");

      if (
        !env.ADMIN_API_TOKEN ||
        authorization !==
          `Bearer ${env.ADMIN_API_TOKEN}`
      ) {
        return json(
          {
            error:
              "Unauthorized. Admin access required."
          },
          401
        );
      }

      return null;
    };

    // ==================================================
    // HEALTH CHECK
    // ==================================================

    if (url.pathname === "/api/health") {
      return json({
        status: "ok",
        service: "Streamix API",
        tmdbConfigured:
          Boolean(env.TMDB_READ_ACCESS_TOKEN),
        databaseConfigured:
          Boolean(env.DB)
      });
    }

    // ==================================================
    // TMDB SEARCH
    // ==================================================

    if (
      url.pathname === "/api/tmdb/search" &&
      request.method === "GET"
    ) {
      const query =
        url.searchParams.get("query")?.trim() || "";

      const type =
        url.searchParams.get("type") || "multi";

      if (!query) {
        return json(
          {
            results: []
          },
          400
        );
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

      const tmdbUrl =
        "https://api.themoviedb.org/3/search/" +
        encodeURIComponent(type) +
        "?query=" +
        encodeURIComponent(query) +
        "&include_adult=false";

      const tmdbResponse =
        await fetch(tmdbUrl, {
          headers: {
            Authorization:
              "Bearer " +
              env.TMDB_READ_ACCESS_TOKEN,
            Accept: "application/json"
          }
        });

      const data =
        await tmdbResponse.json();

      if (!tmdbResponse.ok) {
        return json(
          {
            error:
              "TMDB search failed.",
            details: data
          },
          tmdbResponse.status
        );
      }

      return json(data);
    }

    // ==================================================
    // PROFILES - GET
    // ==================================================

    if (
      url.pathname === "/api/profiles" &&
      request.method === "GET"
    ) {
      const result =
        await env.DB
          .prepare(`
            SELECT
              id,
              name,
              avatar,
              sort_order,
              created_at
            FROM profiles
            ORDER BY
              sort_order ASC,
              created_at ASC
          `)
          .all();

      return json(result.results);
    }

    // ==================================================
    // PROFILES - POST
    // ==================================================

    if (
      url.pathname === "/api/profiles" &&
      request.method === "POST"
    ) {
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
        await env.DB
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
          .bind(id)
          .first();

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

      const existing =
        await env.DB
          .prepare(`
            SELECT *
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

      const sortOrder =
        body.sort_order !== undefined
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
        await env.DB
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
          .bind(body.id)
          .first();

      return json(result);
    }

    // ==================================================
    // PROFILES - DELETE
    // ==================================================

    if (
      url.pathname === "/api/profiles" &&
      request.method === "DELETE"
    ) {
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

      if (id === "admin") {
        return json(
          {
            error:
              "The admin profile cannot be deleted."
          },
          400
        );
      }

      await env.DB
        .prepare(`
          DELETE FROM watch_history
          WHERE profile_id = ?
        `)
        .bind(id)
        .run();

      await env.DB
        .prepare(`
          DELETE FROM watchlist
          WHERE profile_id = ?
        `)
        .bind(id)
        .run();

      await env.DB
        .prepare(`
          DELETE FROM profiles
          WHERE id = ?
        `)
        .bind(id)
        .run();

      return json({
        success: true
      });
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

      return json(result.results);
    }

    // ==================================================
    // LIBRARY - POST
    // ==================================================

    if (
      url.pathname === "/api/library" &&
      request.method === "POST"
    ) {
      // NEW: Only the admin can add movies.
      const unauthorized =
        requireAdmin();

      if (unauthorized) {
        return unauthorized;
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
        body.id ||
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

      return json(
        result,
        201
      );
    }

    // ==================================================
    // LIBRARY - DELETE
    // ==================================================

    if (
      url.pathname === "/api/library" &&
      request.method === "DELETE"
    ) {
      // NEW: Only the admin can remove movies.
      const unauthorized =
        requireAdmin();

      if (unauthorized) {
        return unauthorized;
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
          DELETE FROM watch_history
          WHERE library_item_id = ?
        `)
        .bind(id)
        .run();

      await env.DB
        .prepare(`
          DELETE FROM watchlist
          WHERE library_item_id = ?
        `)
        .bind(id)
        .run();

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
    // WATCHED - GET
    // ==================================================

    if (
      url.pathname === "/api/watch-history" &&
      request.method === "GET"
    ) {
      const profileId =
        url.searchParams.get(
          "profileId"
        );

      if (!profileId) {
        return json(
          {
            error:
              "profileId is required."
          },
          400
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

      return json(result.results);
    }

    // ==================================================
    // WATCHED - POST
    // ==================================================

    if (
      url.pathname ===
        "/api/watch-history" &&
      request.method === "POST"
    ) {
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

      const id =
        crypto.randomUUID();

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
          id,
          body.profileId,
          body.libraryItemId
        )
        .run();

      return json({
        success: true
      });
    }

    // ==================================================
    // WATCHED - DELETE
    // ==================================================

    if (
      url.pathname ===
        "/api/watch-history" &&
      request.method === "DELETE"
    ) {
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
      const profileId =
        url.searchParams.get(
          "profileId"
        );

      if (!profileId) {
        return json(
          {
            error:
              "profileId is required."
          },
          400
        );
      }

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

      return json(result.results);
    }

    // ==================================================
    // WATCHLIST - POST
    // ==================================================

    if (
      url.pathname === "/api/watchlist" &&
      request.method === "POST"
    ) {
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

      const id =
        crypto.randomUUID();

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
          id,
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
    // NOT FOUND
    // ==================================================

    return json(
      {
        error:
          "Route not found."
      },
      404
    );
  }
};

