import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createRoot } from "react-dom/client";
import {
Bell,
Check,
Plus,
ChevronDown,
GripVertical,
Clock,
Eye,
EyeOff,
Film,
Heart, 
ArrowUp,
Search,
Settings,
Trash2,
Tv,
X
} from "lucide-react";
import "./styles.css"; 
   
/* =========================================================
TYPES 
========================================================= */

type Kind = "movie" | "tv";

type Title = {
  id: string;
  name: string;
  kind: Kind;
  year: number;
  releaseDate?: string;
  poster: string;
  backdrop: string;
  overview: string;
  popularity: number;
  addedAt?: string;
};

type Profile = {
id: string;
name: string;
avatar: string;
};

type State = {
watched: string[];
watchlist: string[];
rewatch: string[];
};

type Reminder = {
  id: string;
  profileId: string;
  titleId: string;
  date: string;
  time: string;
  method: "push" | "calendar" | "both";
};

type Scheduled = {
id: string;
profileId: string;
titleId: string;
date: string;
time: string;
message: string;
};

type SortOption =
  | "default"
  | "just-added"
  | "popularity"
  | "year-desc"
  | "year-asc"
  | "name-asc"
  | "name-desc";

type HeroSettings = {
titleId: string | null;
positionX: number;
positionY: number;
};

 /* =========================================================
PUSH NOTIFICATIONS
========================================================= */

const VAPID_PUBLIC_KEY =
  "BDEEMiOfULTJ28A46fKl6j-ssmIinKrVbyPIYIw5Q9Ybx0YniTtSKPC-iJNTvP3Spkylm4eTnTaXShfepvmNfVY";

function urlBase64ToUint8Array(
  base64String: string
): Uint8Array {
  const padding =
    "=".repeat(
      (4 - (base64String.length % 4)) % 4
    );

  const base64 =
    (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const rawData =
    atob(base64);

  const outputArray =
    new Uint8Array(
      rawData.length
    );

  for (
    let i = 0;
    i < rawData.length;
    ++i
  ) {
    outputArray[i] =
      rawData.charCodeAt(i);
  }

  return outputArray;
}

/* =========================================================
DEFAULT DATA
========================================================= */


const initialState: Record<string, State> = {
admin: {
watched: [],
watchlist: [],
rewatch: []
}
};

const initialHero: HeroSettings = {
titleId: null,
positionX: 50,
positionY: 50
};

/* =========================================================
HELPERS
========================================================= */

function uid(): string {
return (
Math.random().toString(36).slice(2) +
Date.now().toString(36)
);
}

function getPosterUrl(
path: string | null | undefined
): string {
if (!path) {
return "https://placehold.co/500x750/171717/ffffff?text=No+Poster";
}

return (
"https://image.tmdb.org/t/p/w500" +
path
);
}

function getBackdropUrl(
path: string | null | undefined
): string {
if (!path) {
return "";
}

return (
"https://image.tmdb.org/t/p/w1280" +
path
);
}

/* =========================================================
TMDB
========================================================= */

async function searchTMDB(
query: string
): Promise<Title[]> {
const cleanQuery = query.trim();

if (!cleanQuery) {
return [];
}
  const API_BASE_URL =
  "https://streamix.gaintrainstrong.workers.dev";

async function apiFetch(
  path: string,
  options: RequestInit = {}
) {
  const sessionId =
    localStorage.getItem("sx-session-token");

  const headers = new Headers(
    options.headers || {}
  );

  headers.set(
    "Content-Type",
    "application/json"
  );

  if (sessionId) {
    headers.set(
      "Authorization",
      `Bearer ${sessionId}`
    );
  }

  const response = await fetch(
    API_BASE_URL + path,
    {
      ...options,
      headers
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
      "Something went wrong."
    );
  }

  return data;
}
  
const url =
  API_BASE_URL +
  "/api/tmdb/search?query=" +
  encodeURIComponent(cleanQuery) +
  "&type=multi";

const sessionId =
  localStorage.getItem("sx-session-token");

const response = await fetch(
  url,
  {
    headers: sessionId
      ? {
          Authorization:
            `Bearer ${sessionId}`
        }
      : {}
  }
);

if (!response.ok) {
  throw new Error("TMDB search failed");
}

const data = await response.json();

const results = Array.isArray(data.results)
? data.results
: [];

return results
.filter(
(item: any) =>
item &&
(item.media_type === "movie" ||
item.media_type === "tv")
)
.map((item: any): Title => {
const kind: Kind =
item.media_type === "tv"
? "tv"
: "movie";


  const releaseDate =
    kind === "movie"
      ? item.release_date
      : item.first_air_date;

  const year =
    releaseDate &&
    typeof releaseDate === "string"
      ? Number(
          releaseDate.slice(0, 4)
        )
      : 0;

  const name =
    kind === "movie"
      ? item.title || "Untitled"
      : item.name || "Untitled";

  return {
    id:
      "tmdb-" +
      kind +
      "-" +
      String(item.id),
    name,
    kind,
    year,
    poster: getPosterUrl(
      item.poster_path
    ),
    backdrop: getBackdropUrl(
      item.backdrop_path
    ),
    overview:
      typeof item.overview === "string"
        ? item.overview
        : "",
    addedAt:
      new Date().toISOString()
  };
});


}

async function ensureTMDBLibraryItem(
  title: Title
): Promise<Title> {
  const API_BASE_URL =
    "https://streamix.gaintrainstrong.workers.dev";

  const sessionId =
    localStorage.getItem(
      "sx-session-token"
    );

  const response =
    await fetch(
      API_BASE_URL +
        "/api/library/ensure",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          ...(sessionId
            ? {
                Authorization:
                  `Bearer ${sessionId}`
              }
            : {})
        },
        body: JSON.stringify({
          tmdb_id: Number(
            title.id
              .split("-")
              .pop()
          ),
          media_type:
            title.kind,
          title:
            title.name,
          poster_path:
            title.poster
              ? title.poster.replace(
                  "https://image.tmdb.org/t/p/w500",
                  ""
                )
              : null,
          backdrop_path:
            title.backdrop
              ? title.backdrop.replace(
                  "https://image.tmdb.org/t/p/w1280",
                  ""
                )
              : null,
          overview:
            title.overview,
          release_date:
            title.year
              ? `${title.year}-01-01`
              : null
        })
      }
    );

const data =
  await response.json();


  if (!response.ok) {
    throw new Error(
      data?.error ||
        "Failed to save TMDB title."
    );
  }

  return {
    ...title,
    id:
      data.id ||
      title.id
  };
}

/* =========================================================
APP
========================================================= */

function App() {
  const [library, setLibrary] = useState<Title[]>([]);

   const [libraryLoading, setLibraryLoading] =
  useState(true);

    const [kind, setKind] =
   useState<"all" | Kind>("all");

 const [kindClicked, setKindClicked] =
   useState(true);

const [sort, setSort] =
  useState<SortOption>("default");
   
const [
  tmdbCatalog,
  setTmdbCatalog
] = useState<Title[]>([]);

const [
  tmdbCatalogPage,
  setTmdbCatalogPage
] = useState(1);

const [
  tmdbCatalogLoading,
  setTmdbCatalogLoading
] = useState(false);

const [
  tmdbCatalogHasMore,
  setTmdbCatalogHasMore
] = useState(true);

const [
  tmdbCatalogLimit,
  setTmdbCatalogLimit
] = useState(40);

const [
  tmdbCatalogKey,
  setTmdbCatalogKey
] = useState("");

const tmdbCatalogCache =
  useRef<Record<string, Title[]>>({});
   
useEffect(() => {
  const controller =
    new AbortController();

  async function loadTMDBCatalog() {
    const cacheKey =
      `${kind}-catalog`;

    const cachedCatalog =
      tmdbCatalogCache.current[
        cacheKey
      ];

    if (cachedCatalog) {
      setTmdbCatalog(
        cachedCatalog
      );

      setTmdbCatalogKey(
        cacheKey
      );

      setTmdbCatalogPage(1);
      setTmdbCatalogHasMore(true);
      setTmdbCatalogLimit(40);
      setTmdbCatalogLoading(false);

      return;
    }

    setTmdbCatalogLoading(true);

    try {
      const sessionId =
        localStorage.getItem(
          "sx-session-token"
        );

      const response =
        await fetch(
          "https://streamix.gaintrainstrong.workers.dev/api/tmdb/catalog?page=1&type=" +
            kind +
            "&sort=popularity",
          {
            signal:
              controller.signal,
            headers: sessionId
              ? {
                  Authorization:
                    `Bearer ${sessionId}`
                }
              : {}
          }
        );

      if (!response.ok) {
        throw new Error(
          "Failed to load TMDB catalog"
        );
      }

      const data =
        await response.json();

      if (controller.signal.aborted) {
        return;
      }

      const titles: Title[] =
        Array.isArray(data.results)
          ? data.results.map(
              (item: any): Title => {
                const itemKind: Kind =
                  item.media_type === "tv"
                    ? "tv"
                    : "movie";

                const releaseDate =
                  itemKind === "movie"
                    ? item.release_date
                    : item.first_air_date;

                return {
                  id:
                    "tmdb-" +
                    itemKind +
                    "-" +
                    String(item.id),

                  name:
                    itemKind === "movie"
                      ? item.title ||
                        "Untitled"
                      : item.name ||
                        "Untitled",

                  kind:
                    itemKind,

                  year:
                    releaseDate
                      ? Number(
                          String(
                            releaseDate
                          ).slice(0, 4)
                        )
                      : 0,

                  releaseDate:
                    releaseDate || "",

                  poster:
                    getPosterUrl(
                      item.poster_path
                    ),

                  backdrop:
                    getBackdropUrl(
                      item.backdrop_path
                    ),

                  overview:
                    item.overview || "",

                  popularity:
                    Number(
                      item.popularity || 0
                    ),

                  addedAt:
                    new Date().toISOString()
                };
              }
            )
          : [];

      if (controller.signal.aborted) {
        return;
      }

      tmdbCatalogCache.current[
        cacheKey
      ] = titles;

      setTmdbCatalog(
        titles
      );

      setTmdbCatalogKey(
        cacheKey
      );

      localStorage.setItem(
        "sx-tmdb-catalog-" +
          cacheKey,
        JSON.stringify(titles)
      );

      setTmdbCatalogPage(1);

      setTmdbCatalogHasMore(
        1 <
          Number(
            data.total_pages || 0
          )
      );

      setTmdbCatalogLimit(
        40
      );
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      console.error(
        "Failed to load TMDB catalog:",
        error
      );

      setTmdbCatalogPage(1);
      setTmdbCatalogHasMore(false);
    } finally {
      if (!controller.signal.aborted) {
        setTmdbCatalogLoading(
          false
        );
      }
    }
  }

  loadTMDBCatalog();

  return () => {
    controller.abort();
  };
}, [kind]);

async function loadNextTMDBCatalogPage() {
  if (
    tmdbCatalogLoading ||
    tmdbCatalogLimit >= 200 ||
    !tmdbCatalogHasMore
  ) {
    return;
  }

  const controller =
    new AbortController();

  setTmdbCatalogLoading(true);

  try {
    const sessionId =
      localStorage.getItem(
        "sx-session-token"
      );

    const nextPage =
      tmdbCatalogPage + 1;

    const response =
      await fetch(
        `https://streamix.gaintrainstrong.workers.dev/api/tmdb/catalog?page=${nextPage}&type=${kind}&sort=${sort === "default" ? "popularity" : sort}`,
        {
          signal:
            controller.signal,
          headers: sessionId
            ? {
                Authorization:
                  `Bearer ${sessionId}`
              }
            : {}
        }
      );

    if (!response.ok) {
      throw new Error(
        "Failed to load next TMDB catalog page"
      );
    }

    const data =
      await response.json();

    if (controller.signal.aborted) {
      return;
    }

    const titles: Title[] =
      Array.isArray(data.results)
        ? data.results.map(
            (item: any): Title => {
              const itemKind: Kind =
                item.media_type === "tv"
                  ? "tv"
                  : "movie";

              const releaseDate =
                itemKind === "movie"
                  ? item.release_date
                  : item.first_air_date;

              return {
                id:
                  "tmdb-" +
                  itemKind +
                  "-" +
                  String(item.id),

                name:
                  itemKind === "movie"
                    ? item.title ||
                      "Untitled"
                    : item.name ||
                      "Untitled",

                kind:
                  itemKind,

                year:
                  releaseDate
                    ? Number(
                        String(
                          releaseDate
                        ).slice(0, 4)
                      )
                    : 0,

                releaseDate:
                  releaseDate || "",

                poster:
                  getPosterUrl(
                    item.poster_path
                  ),

                backdrop:
                  getBackdropUrl(
                    item.backdrop_path
                  ),

                overview:
                  item.overview || "",

                popularity:
                  Number(
                    item.popularity || 0
                  ),

                addedAt:
                  new Date().toISOString()
              };
            }
          )
        : [];

    if (controller.signal.aborted) {
      return;
    }

    setTmdbCatalog(
      current => {
        const existingIds =
          new Set(
            current.map(
              title =>
                title.id
            )
          );

        const newTitles =
          titles.filter(
            title => {
              if (
                existingIds.has(
                  title.id
                )
              ) {
                return false;
              }

              existingIds.add(
                title.id
              );

              return true;
            }
          );

        const nextCatalog = [
          ...current,
          ...newTitles
        ];

        localStorage.setItem(
          "sx-tmdb-catalog",
          JSON.stringify(
            nextCatalog
          )
        );

        return nextCatalog;
      }
    );

    setTmdbCatalogPage(
      nextPage
    );

    setTmdbCatalogHasMore(
      nextPage <
        Number(
          data.total_pages || 0
        )
    );

    setTmdbCatalogLimit(
      current =>
        Math.min(
          current + 40,
          200
        )
    );
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      return;
    }

    console.error(
      "Failed to load next TMDB catalog page:",
      error
    );
  } finally {
    if (!controller.signal.aborted) {
      setTmdbCatalogLoading(
        false
      );
    }
  }
}
   
 const [
  justAdded,
  setJustAdded
] = useState<Title[]>([]);

const [
  justAddedLoading,
  setJustAddedLoading
] = useState(true);

const [
  hiddenJustAdded,
  setHiddenJustAdded
] = useState<Title[]>([]);

const [
  justAddedView,
  setJustAddedView
] = useState<
  "visible" | "hidden"
>("visible");

{/* this one piece of code below shows 40 - 40 movies listed before you press show more */}
   const [
  justAddedLimit,
  setJustAddedLimit
] = useState(40);

   const [
  hiddenJustAddedLimit,
  setHiddenJustAddedLimit
] = useState(40);

const [
  hiddenSearch,
  setHiddenSearch
] = useState("");

const [
  isMobile,
  setIsMobile
] = useState(false);

const [
  showScrollTop,
  setShowScrollTop
] = useState(false);

useEffect(() => {
    const mediaQuery =
    window.matchMedia(
      "(max-width: 600px)"
    );

  const updateMobile =
    () => {
      setIsMobile(
        mediaQuery.matches
      );
      setHiddenJustAddedLimit(
        mediaQuery.matches
          ? 20
          : 40
      );
    };

  updateMobile();

  mediaQuery.addEventListener(
    "change",
    updateMobile
  );

  return () =>
    mediaQuery.removeEventListener(
      "change",
      updateMobile
    );
}, []);
   useEffect(() => {
  const handleScroll = () => {
    setShowScrollTop(
      window.scrollY > 100
    );
  };

  window.addEventListener(
    "scroll",
    handleScroll,
    { passive: true }
  );

  handleScroll();

  return () => {
    window.removeEventListener(
      "scroll",
      handleScroll
    );
  };
}, []);
   
useEffect(() => {
  async function loadLibrary() {
    try {
      const response =
        await fetch("/api/library");

      if (!response.ok) {
        throw new Error(
          "Failed to load library"
        );
      }

      const data =
        await response.json();

      const titles: Title[] =
        Array.isArray(data)
          ? data.map(
              (item: any): Title => {
                const kind: Kind =
                  item.media_type === "tv"
                    ? "tv"
                    : "movie";

                const releaseDate =
                  item.release_date || "";

                return {
                  id:
                    item.id ||
                    (
                      "tmdb-" +
                      kind +
                      "-" +
                      String(
                        item.tmdb_id
                      )
                    ),

                  name:
                    item.title ||
                    "Untitled",

                  kind,

                  year:
                    releaseDate
                      ? Number(
                          String(
                            releaseDate
                          ).slice(0, 4)
                        )
                      : 0,

                  poster:
                    getPosterUrl(
                      item.poster_path
                    ),

                  backdrop:
                    getBackdropUrl(
                      item.backdrop_path
                    ),

                  overview:
                    item.overview || "",

                  addedAt:
                    item.created_at || ""
                };
              }
            )
          : [];

setLibrary(titles);
setLibraryLoading(false);

      /* =================================================
      LOAD HIDDEN JUST ADDED
      ================================================= */

      const sessionId =
        localStorage.getItem(
          "sx-session-token"
        );

      const hiddenResponse =
        await fetch(
          "https://streamix.gaintrainstrong.workers.dev/api/tmdb/just-added/hidden",
          {
            headers: sessionId
              ? {
                  Authorization:
                    `Bearer ${sessionId}`
                }
              : {}
          }
        );

      console.log(
        "HIDDEN RESPONSE:",
        hiddenResponse.status
      );

      console.log(
        "HIDDEN RESPONSE BODY:",
        await hiddenResponse.clone().text()
      );

      if (hiddenResponse.ok) {
        const hiddenData =
          await hiddenResponse.json();

        if (
          Array.isArray(
            hiddenData.results
          )
        ) {
          const hiddenTitles: Title[] =
            hiddenData.results.map(
              (item: any): Title => {

                // Hidden titles saved by the app
                // already contain the complete
                // Title object.
                if (
                  item.name &&
                  item.kind &&
                  typeof item.year ===
                    "number"
                ) {
                  return {
                    id:
                      item.id,

                    name:
                      item.name,

                    kind:
                      item.kind,

                    year:
                      item.year,

                    poster:
                      item.poster || "",

                    backdrop:
                      item.backdrop || "",

                    overview:
                      item.overview || "",

                    addedAt:
                      item.addedAt ||
                      item.hidden_at ||
                      ""
                  };
                }

                // Fallback for any older
                // TMDB-format hidden records.
                const kind: Kind =
                  item.media_type === "tv"
                    ? "tv"
                    : "movie";

                const releaseDate =
                  kind === "movie"
                    ? item.release_date
                    : item.first_air_date;

                return {
                  id:
                    "tmdb-" +
                    kind +
                    "-" +
                    String(item.id),

                  name:
                    kind === "movie"
                      ? item.title ||
                        "Untitled"
                      : item.name ||
                        "Untitled",

                  kind,

                  year:
                    releaseDate
                      ? Number(
                          String(
                            releaseDate
                          ).slice(0, 4)
                        )
                      : 0,

                  poster:
                    getPosterUrl(
                      item.poster_path
                    ),

                  backdrop:
                    getBackdropUrl(
                      item.backdrop_path
                    ),

                  overview:
                    item.overview || "",

                  addedAt:
                    item.hidden_at || ""
                };
              }
            );

          setHiddenJustAdded(
            Array.from(
              new Map(
                hiddenTitles.map(
                  title => [
                    title.id,
                    title
                  ]
                )
              ).values()
            )
          );
        }
      }

    } catch (error) {
      console.error(
        "Failed to load library:",
        error
      );
    }
  }

  loadLibrary();

  const handleAppResume = () => {
    if (
      document.visibilityState ===
      "visible"
    ) {
      loadLibrary();
    }
  };

  document.addEventListener(
    "visibilitychange",
    handleAppResume
  );

  window.addEventListener(
    "focus",
    handleAppResume
  );

  return () => {
    document.removeEventListener(
      "visibilitychange",
      handleAppResume
    );

    window.removeEventListener(
      "focus",
      handleAppResume
    );
  };
}, []);

  const [
    profiles,
    setProfiles
  ] = useState<Profile[]>([]);

  const [
    profilesLoading,
    setProfilesLoading
  ] = useState(true);

  const [
    deletedProfiles,
    setDeletedProfiles
  ] = useState<Profile[]>([]);

  const [
    deletedProfilesLoading,
    setDeletedProfilesLoading
  ] = useState(false);

  useEffect(() => {
    async function loadProfiles() {
      try {
        const sessionId =
          localStorage.getItem(
            "sx-session-token"
          );

        const response =
          await fetch(
            "/api/profiles",
            {
              headers: sessionId
                ? {
                    Authorization:
                      `Bearer ${sessionId}`
                  }
                : {}
            }
          );

        if (!response.ok) {
          throw new Error(
            "Failed to load profiles"
          );
        }

        const data =
          await response.json();

        setProfiles(data);
      } catch (error) {
        console.error(
          "Failed to load profiles:",
          error
        );
      } finally {
        setProfilesLoading(false);
      }
    }

    loadProfiles();
  }, []);

  const [
    states,
    setStates
  ] = useState<
    Record<string, State>
  >({});

  const [
    reminders,
    setReminders
  ] = useState<Reminder[]>([]);

  const [
    scheduled,
    setScheduled
  ] = useState<Scheduled[]>([]);

const [
  heroSettingsLoading,
  setHeroSettingsLoading
] = useState(true);

const [
  heroSettings,
  setHeroSettings
] =
  useState<HeroSettings>(
    initialHero
  );

  useEffect(() => {
    async function loadHeroSettings() {
      try {
        const response =
          await fetch(
            "/api/hero-settings"
          );

        if (!response.ok) {
          throw new Error(
            "Failed to load hero settings"
          );
        }

        const data =
          await response.json();

        setHeroSettings({
          titleId:
            data.library_item_id ??
            null,

          positionX:
            Number(
              data.position_x ?? 50
            ),

          positionY:
            Number(
              data.position_y ?? 50
            )
        });
     } catch (error) {
    console.error(
      "Failed to load hero settings:",
      error
    );
  } finally {
    setHeroSettingsLoading(false);
  }
}

loadHeroSettings();
  }, []);
   
 /* =======================================================
 AUTHENTICATION / SESSION
 ======================================================= */

 const [profileId, setProfileId] =
   useState<string | null>(null);

 const [viewingAs, setViewingAs] =
   useState<string | null>(() =>
     localStorage.getItem(
       "sx-viewing-as"
     )
   );

 const [sessionRestoring, setSessionRestoring] =
   useState(true);

     const [pushPermission, setPushPermission] =
    useState<NotificationPermission>(
      "default"
    );

  const [pushSubscribed, setPushSubscribed] =
    useState(false);

 useEffect(() => {
   async function restoreSession() {
     const sessionId =
       localStorage.getItem(
         "sx-session-token"
       );

     if (!sessionId) {
       setSessionRestoring(false);
       return;
     }

     try {
       const response = await fetch(
         "https://streamix.gaintrainstrong.workers.dev/api/auth/session",
         {
           method: "GET",
           headers: {
             Authorization:
               `Bearer ${sessionId}`
           }
         }
       );

    if (!response.ok) {
  // The saved session is no longer valid.
  localStorage.removeItem(
    "sx-session-token"
  );
  setProfileId(null);
  setViewingAs(null);
  setSessionRestoring(false);
  return;
}

const data =
  await response.json();

if (
  data.authenticated &&
  data.profile?.id
) {
  const savedTestingProfile =
    localStorage.getItem(
      "sx-testing-active"
    );

  if (
    data.profile.id === "admin" &&
    savedTestingProfile === "true"
  ) {
    setProfileId(
      "testing"
    );
  } else {
    setProfileId(
      data.profile.id
    );
  }
}
else {
  localStorage.removeItem(
    "sx-session-token"
  );
  setProfileId(null);
  setViewingAs(null);
}
} catch (error) {
  console.error(
    "Failed to restore session:",
    error
  );

       // Keep the saved session if this was
       // only a temporary network problem.
     } finally {
       setSessionRestoring(false);
     }
   }

   restoreSession();
 }, []);

   useEffect(() => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (!("Notification" in window)) {
    return;
  }

  const checkPushStatus = async () => {
    try {
      if (!profileId) {
        return;
      }

      const registration =
        await navigator.serviceWorker.register(
          "/sw.js"
        );

      await navigator.serviceWorker.ready;

      const permission =
        Notification.permission;

      setPushPermission(permission);

      if (permission !== "granted") {
        return;
      }

      const existingSubscription =
        await registration.pushManager.getSubscription();

      if (existingSubscription) {
        const sessionId =
          localStorage.getItem(
            "sx-session-token"
          );

        if (!sessionId) {
          return;
        }

        const response =
          await fetch(
            "https://streamix.gaintrainstrong.workers.dev/api/push/subscribe",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Authorization:
                  `Bearer ${sessionId}`
              },
              body: JSON.stringify({
                subscription:
                  existingSubscription,
                profileId
              })
            }
          );

        if (!response.ok) {
          throw new Error(
            "Failed to sync push subscription."
          );
        }

        setPushSubscribed(true);

        console.log(
          "PUSH SUBSCRIPTION SYNCED"
        );

        return;
      }

      await subscribeToPushNotifications();

    } catch (error) {
      console.error(
        "Failed to initialize push notifications:",
        error
      );
    }
  };

  checkPushStatus();
}, [profileId]);

   useEffect(() => {
  async function loadReminders() {
    if (!profileId) {
      setReminders([]);
      return;
    }

    try {
      const sessionId =
        localStorage.getItem(
          "sx-session-token"
        );

      if (!sessionId) {
        setReminders([]);
        return;
      }

      const reminderProfileId =
        profileId === "admin" &&
        localStorage.getItem(
          "sx-testing-active"
        ) === "true"
          ? "testing"
          : profileId;

      const response =
        await fetch(
          `/api/reminders?profileId=${encodeURIComponent(
            reminderProfileId
          )}`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${sessionId}`
            }
          }
        );

      if (!response.ok) {
        throw new Error(
          "Failed to load reminders."
        );
      }

      const data =
        await response.json();

      console.log(
        "REMINDERS GET RESPONSE:",
        data
      );

      setReminders(
        data
          .filter(
            (reminder: any) =>
              !reminder.sent_at
          )
          .map(
            (reminder: any) => ({
              id: reminder.id,
              profileId:
                reminder.profile_id,
              titleId:
                reminder.library_item_id,
              date:
                reminder.reminder_date,
              time:
                reminder.reminder_time,
              method: "push",
              title:
                reminder.title,
              posterPath:
                reminder.poster_path
            })
          )
      );
    } catch (error) {
      console.error(
        "Failed to load reminders:",
        error
      );

      setReminders([]);
    }
  }

  loadReminders();

  const reminderRefresh =
    window.setInterval(
      loadReminders,
      30000
    );

  return () => {
    window.clearInterval(
      reminderRefresh
    );
  };
}, [profileId]);

async function subscribeToPushNotifications() {
  console.log(
    "PUSH DEBUG 1: subscribeToPushNotifications() STARTED"
  );

  try {
    console.log(
      "PUSH DEBUG 2: Feature support",
      {
        serviceWorker:
          "serviceWorker" in navigator,
        pushManager:
          "PushManager" in window,
        notification:
          "Notification" in window
      }
    );

    if (!("serviceWorker" in navigator)) {
      console.error(
        "PUSH DEBUG FAILED: Service workers are unavailable."
      );
      return;
    }

    if (!("PushManager" in window)) {
      console.error(
        "PUSH DEBUG FAILED: PushManager is unavailable."
      );
      return;
    }

    if (!("Notification" in window)) {
      console.error(
        "PUSH DEBUG FAILED: Notification API is unavailable."
      );
      return;
    }

    let permission =
      Notification.permission;

    console.log(
      "PUSH DEBUG 3: Notification permission BEFORE request:",
      permission
    );

    if (permission === "default") {
      console.log(
        "PUSH DEBUG 4: Requesting notification permission..."
      );

      permission =
        await Notification.requestPermission();

      console.log(
        "PUSH DEBUG 5: Notification permission AFTER request:",
        permission
      );
    }

    setPushPermission(permission);

    if (permission !== "granted") {
      console.error(
        "PUSH DEBUG FAILED: Notification permission is not granted:",
        permission
      );
      return;
    }

    console.log(
      "PUSH DEBUG 6: Registering /sw.js..."
    );

    const registration =
      await navigator.serviceWorker.register(
        "/sw.js"
      );

    console.log(
      "PUSH DEBUG 7: Service worker registered",
      {
        scope: registration.scope,
        active:
          registration.active?.state ||
          null,
        installing:
          registration.installing?.state ||
          null,
        waiting:
          registration.waiting?.state ||
          null
      }
    );

    console.log(
      "PUSH DEBUG 8: Waiting for service worker..."
    );

    await navigator.serviceWorker.ready;

    console.log(
      "PUSH DEBUG 9: Service worker READY"
    );

    const publicKey =
      "BDEEMiOfULTJ28A46fKl6j-ssmIinKrVbyPIYIw5Q9Ybx0YniTtSKPC-iJNTvP3Spkylm4eTnTaXShfepvmNfVY";

    if (!publicKey) {
      console.error(
        "PUSH DEBUG FAILED: Missing VAPID public key."
      );
      return;
    }

    console.log(
      "PUSH DEBUG 10: Checking existing push subscription..."
    );

    let subscription =
      await registration.pushManager.getSubscription();

    console.log(
      "PUSH DEBUG 11: Existing subscription:",
      subscription
        ? {
            endpoint:
              subscription.endpoint,
            expirationTime:
              subscription.expirationTime
          }
        : null
    );

    if (!subscription) {
      console.log(
        "PUSH DEBUG 12: NO existing subscription. Starting pushManager.subscribe()..."
      );

      subscription =
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            urlBase64ToUint8Array(
              publicKey
            )
        });

      console.log(
        "PUSH DEBUG 13: pushManager.subscribe() SUCCEEDED",
        {
          endpoint:
            subscription.endpoint,
          expirationTime:
            subscription.expirationTime
        }
      );
    } else {
      console.log(
        "PUSH DEBUG 12: Existing subscription will be reused."
      );
    }

    if (!subscription) {
      console.error(
        "PUSH DEBUG FAILED: No push subscription exists."
      );
      return;
    }

    const sessionId =
      localStorage.getItem(
        "sx-session-token"
      );

    console.log(
      "PUSH DEBUG 14: Session check",
      {
        hasSession:
          Boolean(sessionId),
        profileId
      }
    );

    if (!sessionId) {
      console.error(
        "PUSH DEBUG FAILED: No active session."
      );
      return;
    }

    console.log(
      "PUSH DEBUG 15: Sending subscription to Cloudflare..."
    );

    const response =
      await fetch(
        "https://streamix.gaintrainstrong.workers.dev/api/push/subscribe",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${sessionId}`
          },
          body: JSON.stringify({
            subscription,
            profileId
          })
        }
      );

    const responseBody =
      await response.text();

    console.log(
      "PUSH DEBUG 16: Cloudflare response",
      {
        status:
          response.status,
        ok:
          response.ok,
        body:
          responseBody,
        profileId
      }
    );

    if (!response.ok) {
      throw new Error(
        "Failed to save push subscription."
      );
    }

    setPushSubscribed(true);

    console.log(
      "PUSH DEBUG 17: PUSH SUBSCRIPTION COMPLETE"
    );
  } catch (error) {
    console.error(
      "PUSH DEBUG FAILED: subscribeToPushNotifications() ERROR",
      error
    );
  }
}
   
 const [tab, setTab] =
   useState<"library" | "rewatch">(
     "library"
   );

 const [filter, setFilter] =
   useState<
     "all" | "watchlist" | "watched" | "rewatch"
   >("all");

 const [filterClicked, setFilterClicked] =
   useState(false);

useEffect(() => {
  setJustAddedLoading(true);

  async function loadJustAdded() {
    
    try {
      const sessionId =
        localStorage.getItem(
          "sx-session-token"
        );

      const response = await fetch(
        "https://streamix.gaintrainstrong.workers.dev/api/tmdb/just-added",
        {
          headers: sessionId
            ? {
                Authorization:
                  `Bearer ${sessionId}`
              }
            : {}
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load Just Added."
        );
      }

      const results =
        Array.isArray(data.results)
          ? data.results
          : [];

      const titles: Title[] =
        results
          .filter(
            (item: any) =>
              typeof item.poster_path === "string" &&
              item.poster_path.trim() !== ""
          )
          .map(
            (item: any): Title => {
              const kind: Kind =
                item.media_type === "tv"
                  ? "tv"
                  : "movie";

              const releaseDate =
                kind === "movie"
                  ? item.release_date
                  : item.first_air_date;

              const year =
                releaseDate &&
                typeof releaseDate ===
                  "string"
                  ? Number(
                      releaseDate.slice(0, 4)
                    )
                  : 0;

              const name =
                kind === "movie"
                  ? item.title ||
                    "Untitled"
                  : item.name ||
                    "Untitled";

              return {
                id:
                  "tmdb-" +
                  kind +
                  "-" +
                  String(item.id),
                name,
                kind,
                year,
                poster:
                  getPosterUrl(
                    item.poster_path
                  ),
                backdrop:
                  getBackdropUrl(
                    item.backdrop_path
                  ),
                overview:
                  typeof item.overview ===
                  "string"
                    ? item.overview
                    : "",
                addedAt:
                  releaseDate || ""
              };
            }
          );

      const dedupedTitles =
        Array.from(
          new Map(
            titles.map(
              title => [
                title.id,
                title
              ]
            )
          ).values()
        );

      setJustAdded(
        dedupedTitles
      );

      setJustAddedLoading(false);
    } catch (error) {
      console.error(
        "Failed to load Just Added:",
        error
      );

      setJustAdded([]);

      setJustAddedLoading(false);
    }
  }

  loadJustAdded();
}, []);

 const [q, setQ] = useState("");

 const [showProfile, setShowProfile] =
   useState(false);

   const [showNotifications, setShowNotifications] =
  useState(false);

   const [showReminderList, setShowReminderList] =
  useState(false);
   
   const [watchlistMessage, setWatchlistMessage] =
  useState("");

 const [loginProfile, setLoginProfile] =
   useState<Profile | null>(null);

 const [showAdd, setShowAdd] =
   useState(false);

 const [showReco, setShowReco] =
   useState(false);

 const [showReminder, setShowReminder] =
   useState<Title | null>(null);
  
  const [heroWatchlistMessage, setHeroWatchlistMessage] =
  useState("");

  const [showDetails, setShowDetails] =
  useState<Title | null>(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const detailsId =
      params.get("details");

    if (!detailsId) {
      return null;
    }

    return {
      id: detailsId,
      name: "",
      kind: detailsId.startsWith(
        "tmdb-tv-"
      )
        ? "tv"
        : "movie",
      year: 0,
      poster: "",
      backdrop: "",
      overview: ""
    };
  });

const [showDetailsData, setShowDetailsData] =
  useState<any | null>(null);

   const tmdbDetailsCache =
  new Map<string, any>();

async function fetchTMDBDetails(
  title: Title
) {
  const cacheKey =
    title.kind + ":" + title.id;

  const cached =
    tmdbDetailsCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const sessionId =
    localStorage.getItem(
      "sx-session-token"
    );

  if (!sessionId) {
    throw new Error(
      "You must be logged in to view details."
    );
  }

  const prefix =
    title.kind === "movie"
      ? "tmdb-movie-"
      : "tmdb-tv-";

  if (!title.id.startsWith(prefix)) {
    throw new Error(
      "This title does not have a TMDB ID."
    );
  }

  const tmdbId =
    title.id.slice(prefix.length);

  const response =
    await fetch(
      "https://streamix.gaintrainstrong.workers.dev/api/tmdb/details?type=" +
        encodeURIComponent(
          title.kind
        ) +
        "&id=" +
        encodeURIComponent(
          tmdbId
        ),
      {
        headers: {
          Authorization:
            `Bearer ${sessionId}`
        }
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
        "Unable to load title details."
    );
  }

  tmdbDetailsCache.set(
    cacheKey,
    data
  );

  return data;
}
   
async function openDetails(title: Title) {
  try {
    const details =
      await fetchTMDBDetails(title);

    setShowDetailsData(details);

    const params =
      new URLSearchParams(
        window.location.search
      );

    params.set(
      "details",
      title.id
    );

    window.history.pushState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`
    );

    setShowDetails(title);
  } catch (error) {
    console.error(
      "Failed to load title details:",
      error
    );
  }
}

useEffect(() => {
  async function handlePopState() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const detailsId =
      params.get("details");

    if (!detailsId) {
      setShowDetailsData(null);
      setShowDetails(null);
      return;
    }

    const title: Title = {
      id: detailsId,
      name: "",
      kind: detailsId.startsWith(
        "tmdb-tv-"
      )
        ? "tv"
        : "movie",
      year: 0,
      poster: "",
      backdrop: "",
      overview: ""
    };

    try {
      const details =
        await fetchTMDBDetails(title);

      setShowDetailsData(details);
      setShowDetails(title);
    } catch (error) {
      console.error(
        "Failed to load title details from URL:",
        error
      );

      setShowDetailsData(null);
      setShowDetails(title);
    }
  }

  window.addEventListener(
    "popstate",
    handlePopState
  );

  return () => {
    window.removeEventListener(
      "popstate",
      handlePopState
    );
  };
}, []);
   
 const [showSchedule, setShowSchedule] =
   useState<Title | null>(null);

 const [showHero, setShowHero] =
   useState(false);

 const [showDeleted, setShowDeleted] =
   useState(false);

 const [editing, setEditing] =
   useState<Profile | null>(null);

 const [menu, setMenu] =
   useState(false);
   
/* =======================================================
PROFILE DRAGGING
======================================================= */

const [
draggedProfileId,
setDraggedProfileId
] = useState<string | null>(null);

const [
dragOverProfileId,
setDragOverProfileId
] = useState<string | null>(null);

const [
dragPosition,
setDragPosition
] = useState<"before" | "after">(
"after"
);

const [
dragPointerId,
setDragPointerId
] = useState<number | null>(null);

/* =======================================================
PROFILE ORDER
======================================================= */

const orderedProfiles = useMemo(() => {
  const adminProfile = profiles.find(
    profile =>
      profile.id === "admin"
  );

  const testingProfile = profiles.find(
    profile =>
      profile.name.toUpperCase() === "TESTING"
  );

  const regularProfiles =
    profiles.filter(
      profile =>
        profile.id !== "admin" &&
        profile.name.toUpperCase() !== "TESTING"
    );

  return [
    ...(adminProfile
      ? [adminProfile]
      : []),

    ...(testingProfile
      ? [testingProfile]
      : []),

    ...regularProfiles
  ];
}, [profiles]);
   
/* =======================================================
PROFILE DRAG POINTER TRACKING
======================================================= */

useEffect(() => {
if (!draggedProfileId) {
return;
}


function handlePointerMove(
  event: PointerEvent
) {
  if (
    dragPointerId !== null &&
    event.pointerId !== dragPointerId
  ) {
    return;
  }

  event.preventDefault();

  const element =
    document.elementFromPoint(
      event.clientX,
      event.clientY
    ) as HTMLElement | null;

  const row =
    element?.closest(
      "[data-profile-id]"
    ) as HTMLElement | null;

  if (!row) {
    setDragOverProfileId(null);
    return;
  }

  const targetId =
    row.dataset.profileId;

  if (
    !targetId ||
    targetId === draggedProfileId ||
    targetId === "admin"
  ) {
    setDragOverProfileId(null);
    return;
  }

  const rect =
    row.getBoundingClientRect();

  const middle =
    rect.top +
    rect.height / 2;

  const position =
    event.clientY < middle
      ? "before"
      : "after";

  setDragOverProfileId(
    targetId
  );

  setDragPosition(
    position
  );
}

function finishDrag(
  event: PointerEvent
) {
  if (
    dragPointerId !== null &&
    event.pointerId !== dragPointerId
  ) {
    return;
  }

  if (
    draggedProfileId &&
    dragOverProfileId
  ) {
    reorderProfiles(
      draggedProfileId,
      dragOverProfileId,
      dragPosition
    );
  }

  setDraggedProfileId(null);
  setDragOverProfileId(null);
  setDragPointerId(null);
}

function cancelDrag(
  event: PointerEvent
) {
  if (
    dragPointerId !== null &&
    event.pointerId !== dragPointerId
  ) {
    return;
  }

  setDraggedProfileId(null);
  setDragOverProfileId(null);
  setDragPointerId(null);
}

window.addEventListener(
  "pointermove",
  handlePointerMove,
  { passive: false }
);

window.addEventListener(
  "pointerup",
  finishDrag
);

window.addEventListener(
  "pointercancel",
  cancelDrag
);

return () => {
  window.removeEventListener(
    "pointermove",
    handlePointerMove
  );

  window.removeEventListener(
    "pointerup",
    finishDrag
  );

  window.removeEventListener(
    "pointercancel",
    cancelDrag
  );
};


}, [
draggedProfileId,
dragOverProfileId,
dragPosition,
dragPointerId
]);

/* =======================================================
VALIDATE SESSION
======================================================= */

useEffect(() => {
  if (
    profileId === null ||
    profilesLoading
  ) {
    return;
  }

  if (
    !profiles.some(
      profile =>
        profile.id === profileId
    )
  ) {
    setProfileId(null);
    setViewingAs(null);
  }
}, [
  profileId,
  profiles,
  profilesLoading
]);
   
/* =======================================================
CURRENT USER / PERMISSIONS
======================================================= */

const isAdminUser =
  profileId === "admin";

const isViewingAs =
  isAdminUser &&
  viewingAs !== null;

const isAdmin =
  isAdminUser &&
  !isViewingAs;

let effectiveProfileId:
  string | null = profileId;

if (isViewingAs) {
  effectiveProfileId =
    viewingAs;
}

let effectiveProfile:
  Profile | null = null;

if (effectiveProfileId) {
  effectiveProfile =
    profiles.find(
      item =>
        item.id ===
        effectiveProfileId
    ) || null;
}

const profile =
  effectiveProfile;

const state: State =
  effectiveProfileId &&
  states[effectiveProfileId]
    ? states[effectiveProfileId]
    : {
        watched: [],
        watchlist: [],
        rewatch: []
      };
   
/* =======================================================
LOAD WATCHED / WATCHLIST / REWATCH
======================================================= */

useEffect(() => {
  if (!effectiveProfileId) {
    return;
  }

  async function loadMediaState() {
    try {
      const sessionId =
        localStorage.getItem(
          "sx-session-token"
        );

      const headers: HeadersInit =
        sessionId
          ? {
              Authorization:
                `Bearer ${sessionId}`
            }
          : {};

      const profileQuery =
        `?profileId=${encodeURIComponent(
          effectiveProfileId
        )}`;

      const [
        watchedResponse,
        watchlistResponse,
        rewatchResponse
      ] = await Promise.all([
        fetch(
          `/api/watch-history${profileQuery}`,
          {
            headers
          }
        ),

        fetch(
          `/api/watchlist${profileQuery}`,
          {
            headers
          }
        ),

        fetch(
          `/api/rewatch${profileQuery}`,
          {
            headers
          }
        )
      ]);

      if (
        !watchedResponse.ok ||
        !watchlistResponse.ok ||
        !rewatchResponse.ok
      ) {
        throw new Error(
          "Failed to load media state."
        );
      }

      const [
        watchedData,
        watchlistData,
        rewatchData
      ] = await Promise.all([
        watchedResponse.json(),
        watchlistResponse.json(),
        rewatchResponse.json()
      ]);

      setStates(
        currentStates => ({
          ...currentStates,

          [effectiveProfileId]: {
            watched:
              Array.isArray(
                watchedData
              )
                ? watchedData
                    .map(
                      (item: any) =>
                        item.library_item_id
                    )
                    .filter(
                      (id: any) =>
                        typeof id ===
                        "string"
                    )
                : [],

            watchlist:
              Array.isArray(
                watchlistData
              )
                ? watchlistData
                    .map(
                      (item: any) =>
                        item.library_item_id
                    )
                    .filter(
                      (id: any) =>
                        typeof id ===
                        "string"
                    )
                : [],

            rewatch:
              Array.isArray(
                rewatchData
              )
                ? rewatchData
                    .map(
                      (item: any) =>
                        item.library_item_id
                    )
                    .filter(
                      (id: any) =>
                        typeof id ===
                        "string"
                    )
                : []
          }
        })
      );
    } catch (error) {
      console.error(
        "Failed to load media state:",
        error
      );
    }
  }

  loadMediaState();
}, [effectiveProfileId]);

const hero =
  heroSettings.titleId
    ? library.find(
        item =>
          item.id ===
          heroSettings.titleId
      ) || null
    : null;

/* =======================================================
LOAD DELETED PROFILES
======================================================= */

useEffect(() => {
  async function loadDeletedProfiles() {
    if (!isAdminUser) {
      return;
    }

    try {
      setDeletedProfilesLoading(true);

      const sessionId =
        localStorage.getItem(
          "sx-session-token"
        );

      const response =
        await fetch(
          "https://streamix.gaintrainstrong.workers.dev/api/profiles/deleted",
          {
            headers: sessionId
              ? {
                  Authorization:
                    `Bearer ${sessionId}`
                }
              : {}
          }
        );

      if (!response.ok) {
        throw new Error(
          "Failed to load deleted profiles"
        );
      }

      const data =
        await response.json();

      setDeletedProfiles(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(
        "Failed to load deleted profiles:",
        error
      );
    } finally {
      setDeletedProfilesLoading(
        false
      );
    }
  }

  loadDeletedProfiles();
}, [isAdminUser]);


/* =======================================================
RECOMMENDATION
======================================================= */

const recommendation =
useMemo(() => {
const watchlistTitles =
library.filter(title => {
const inWatchlist =
state.watchlist.includes(
title.id
);


      const alreadyWatched =
        state.watched.includes(
          title.id
        );

      return (
        inWatchlist &&
        !alreadyWatched
      );
    });

  return (
    watchlistTitles[0] ||
    null
  );
}, [library, state]);


useEffect(() => {
  if (
    !profileId ||
    !recommendation
  ) {
    return;
  }

  async function checkRecommendationStatus() {
    try {
      const response = await fetch(
        "/api/recommendation-status"
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load recommendation status"
        );
      }

      const data = await response.json();

      if (!data.seen_at) {
        setShowReco(true);
      }
    } catch (error) {
      console.error(
        "Failed to load recommendation status:",
        error
      );
    }
  }

  checkRecommendationStatus();
}, [
  profileId,
  recommendation
]);

const [
  tmdbSearchResults,
  setTmdbSearchResults
] = useState<Title[]>([]);

const [
  tmdbSearchPage,
  setTmdbSearchPage
] = useState(0);

const [
  tmdbSearchLoading,
  setTmdbSearchLoading
] = useState(false);

const [
  tmdbSearchHasMore,
  setTmdbSearchHasMore
] = useState(false);

useEffect(() => {
  const searchQuery = q.trim();

  if (!searchQuery) {
    setTmdbSearchResults([]);
    setTmdbSearchPage(0);
    setTmdbSearchHasMore(false);
    setTmdbSearchLoading(false);
    return;
  }

  let cancelled = false;

  async function searchTMDB() {
    setTmdbSearchLoading(true);

    try {
      const sessionId =
        localStorage.getItem(
          "sx-session-token"
        );

      const response =
        await fetch(
          `https://streamix.gaintrainstrong.workers.dev/api/tmdb/search?query=${encodeURIComponent(
            searchQuery
          )}&type=multi&page=1`,
          {
            headers: sessionId
              ? {
                  Authorization:
                    `Bearer ${sessionId}`
                }
              : {}
          }
        );

      if (!response.ok) {
        throw new Error(
          "Failed to search TMDB"
        );
      }

      const data =
        await response.json();

      if (cancelled) {
        return;
      }

      const titles: Title[] =
        Array.isArray(data.results)
          ? data.results
              .filter(
                (item: any) =>
                  item.media_type === "movie" ||
                  item.media_type === "tv"
              )
              .map(
                (item: any): Title => {
                  const kind: Kind =
                    item.media_type === "tv"
                      ? "tv"
                      : "movie";

                  const releaseDate =
                    kind === "movie"
                      ? item.release_date
                      : item.first_air_date;

                  return {
                    id:
                      "tmdb-" +
                      kind +
                      "-" +
                      String(item.id),

                    name:
                      kind === "movie"
                        ? item.title ||
                          "Untitled"
                        : item.name ||
                          "Untitled",

                    kind,

                    year:
                      releaseDate
                        ? Number(
                            String(
                              releaseDate
                            ).slice(0, 4)
                          )
                        : 0,

                    poster:
                      getPosterUrl(
                        item.poster_path
                      ),

                    backdrop:
                      getBackdropUrl(
                        item.backdrop_path
                      ),

                    overview:
                      item.overview || "",

                    addedAt:
                      new Date().toISOString()
                  };
                }
              )
          : [];

      setTmdbSearchResults(
        titles
      );

      setTmdbSearchPage(1);

      setTmdbSearchHasMore(
        1 <
          Number(
            data.total_pages || 0
          )
      );
    } catch (error) {
      if (!cancelled) {
        console.error(
          "Failed to search TMDB:",
          error
        );

        setTmdbSearchResults([]);
        setTmdbSearchPage(0);
        setTmdbSearchHasMore(false);
      }
    } finally {
      if (!cancelled) {
        setTmdbSearchLoading(false);
      }
    }
  }

  searchTMDB();

  return () => {
    cancelled = true;
  };
}, [q]);

async function loadNextTMDBSearchPage() {
  if (
    tmdbSearchLoading ||
    !q.trim() ||
    !tmdbSearchHasMore
  ) {
    return;
  }

  setTmdbSearchLoading(true);

  try {
    const sessionId =
      localStorage.getItem(
        "sx-session-token"
      );

    const nextPage =
      tmdbSearchPage + 1;

    const response =
      await fetch(
        `https://streamix.gaintrainstrong.workers.dev/api/tmdb/search?query=${encodeURIComponent(
          q.trim()
        )}&type=multi&page=${nextPage}`,
        {
          headers: sessionId
            ? {
                Authorization:
                  `Bearer ${sessionId}`
              }
            : {}
        }
      );

    if (!response.ok) {
      throw new Error(
        "Failed to load more TMDB search results"
      );
    }

    const data =
      await response.json();

    const titles: Title[] =
      Array.isArray(data.results)
        ? data.results
            .filter(
              (item: any) =>
                item.media_type === "movie" ||
                item.media_type === "tv"
            )
            .map(
              (item: any): Title => {
                const kind: Kind =
                  item.media_type === "tv"
                    ? "tv"
                    : "movie";

                const releaseDate =
                  kind === "movie"
                    ? item.release_date
                    : item.first_air_date;

                return {
                  id:
                    "tmdb-" +
                    kind +
                    "-" +
                    String(item.id),

                  name:
                    kind === "movie"
                      ? item.title ||
                        "Untitled"
                      : item.name ||
                        "Untitled",

                  kind,

                  year:
                    releaseDate
                      ? Number(
                          String(
                            releaseDate
                          ).slice(0, 4)
                        )
                      : 0,

                  poster:
                    getPosterUrl(
                      item.poster_path
                    ),

                  backdrop:
                    getBackdropUrl(
                      item.backdrop_path
                    ),

                  overview:
                    item.overview || "",

                  addedAt:
                    new Date().toISOString()
                };
              }
            )
        : [];

    setTmdbSearchResults(
      current => {
        const existingIds =
          new Set(
            current.map(
              title => title.id
            )
          );

        const newTitles =
          titles.filter(
            title => {
              if (
                existingIds.has(
                  title.id
                )
              ) {
                return false;
              }

              existingIds.add(
                title.id
              );

              return true;
            }
          );

        return [
          ...current,
          ...newTitles
        ];
      }
    );

    setTmdbSearchPage(
      nextPage
    );

    setTmdbSearchHasMore(
      nextPage <
        Number(
          data.total_pages || 0
        )
    );
  } catch (error) {
    console.error(
      "Failed to load more TMDB search results:",
      error
    );
  } finally {
    setTmdbSearchLoading(
      false
    );
  }
}
   
/* =======================================================
FILTERING + SORTING
======================================================= */

const visible = useMemo(() => {
  const usingPersonalFilter =
    filter === "watchlist" ||
    filter === "watched" ||
    filter === "rewatch";

  let source: Title[];

  if (filter === "watchlist") {
    source = library.filter(title =>
      state.watchlist.includes(title.id)
    );
  } else if (filter === "watched") {
    source = library.filter(title =>
      state.watched.includes(title.id)
    );
  } else if (filter === "rewatch") {
    source = library.filter(title =>
      state.rewatch.includes(title.id)
    );
  } else if (sort === "just-added") {
    source =
      isAdmin &&
      justAddedView === "hidden"
        ? hiddenJustAdded
        : justAdded;
  } else if (q.trim()) {
    source = tmdbSearchResults;
  } else {
    source = tmdbCatalog;
  }

  let filtered =
    source
      .filter(title => {
        if (
          q.trim() &&
          !usingPersonalFilter &&
          sort !== "just-added"
        ) {
          return true;
        }

        return title.name
          .toLowerCase()
          .includes(
            (
              isAdmin &&
              justAddedView === "hidden"
                ? hiddenSearch
                : q
            ).toLowerCase()
          );
      })
      .filter(title => {
        if (kind === "all") {
          return true;
        }

        return title.kind === kind;
      })
      .filter(
        (title, index, array) =>
          array.findIndex(
            item =>
              item.id === title.id
          ) === index
      );

  if (
    sort === "just-added" &&
    !usingPersonalFilter
  ) {
    const limit =
      isAdmin &&
      justAddedView === "hidden"
        ? hiddenJustAddedLimit
        : justAddedLimit;

    return filtered.slice(
      0,
      limit
    );
  }

  if (
    q.trim() &&
    !usingPersonalFilter &&
    sort !== "just-added"
  ) {
    return filtered.slice(
      0,
      40
    );
  }

  if (
    !q.trim() &&
    !usingPersonalFilter
  ) {
    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    const sorted = [
      ...filtered
    ];

    switch (sort) {
      case "year-desc":
        return sorted
          .filter(
            title =>
              !!title.releaseDate &&
              title.releaseDate <= today
          )
          .sort(
            (a, b) =>
              String(
                b.releaseDate || ""
              ).localeCompare(
                String(
                  a.releaseDate || ""
                )
              )
          );

      case "year-asc":
        return sorted
          .filter(
            title =>
              !!title.releaseDate &&
              title.releaseDate >=
                "1970-01-01" &&
              title.releaseDate <=
                today
          )
          .sort(
            (a, b) =>
              String(
                a.releaseDate || ""
              ).localeCompare(
                String(
                  b.releaseDate || ""
                )
              )
          );

      case "popularity":
        return sorted.sort(
          (a, b) =>
            Number(
              b.popularity || 0
            ) -
            Number(
              a.popularity || 0
            )
        );

      case "name-desc":
        return sorted.sort(
          (a, b) =>
            b.name.localeCompare(
              a.name
            )
        );

      case "name-asc":
      case "default":
      default:
        return sorted.sort(
          (a, b) =>
            a.name.localeCompare(
              b.name
            )
        );
    }
  }

  return [
    ...filtered
  ].sort(
    (a, b) =>
      a.name.localeCompare(
        b.name
      )
  );
}, [
  library,
  tmdbCatalog,
  tmdbSearchResults,
  justAdded,
  hiddenJustAdded,
  q,
  kind,
  filter,
  sort,
  state,
  isAdmin,
  justAddedView,
  hiddenSearch,
  justAddedLimit,
  hiddenJustAddedLimit
]);
   
/* =======================================================
AUTHENTICATION ACTIONS
======================================================= */

function handleLoginSuccess(
  loggedInProfileId: string
) {
  setProfileId(
    loggedInProfileId
  );

  setViewingAs(null);
  setTab("library");
  setFilter("all");
  setKind("all");
  setQ("");
  setMenu(false);
}

function signOut() {
  // Remove the saved login session
  localStorage.removeItem("sx-session-token");
  setProfileId(null);
  setViewingAs(null);

  setShowProfile(false);
  setLoginProfile(null);
  setEditing(null);
  setMenu(false);
  setShowAdd(false);
  setShowReco(false);
  setShowReminder(null);
  setShowSchedule(null);
  setShowHero(false);

  setTab("library");
  setFilter("all");
  setKind("all");
  setQ("");

  setDraggedProfileId(null);
  setDragOverProfileId(null);
  setDragPointerId(null);
}

/* =======================================================
CLOSE RECOMMENDATION
======================================================= */

async function closeRecommendation() {
  if (!profileId) {
    return;
  }

  try {
    await fetch("/api/recommendation-status", {
      method: "POST"
    });
  } catch (error) {
    console.error(
      "Failed to save recommendation status:",
      error
    );
  }

  setShowReco(false);
}
/* =======================================================
STATE ACTIONS
======================================================= */

function updateState(
fn: (current: State) => State
) {
if (!effectiveProfileId) {
return;
}


setStates(currentStates => {
  const currentState =
    currentStates[
      effectiveProfileId
    ] || {
      watched: [],
      watchlist: [],
      rewatch: []
    };

  return {
    ...currentStates,
    [effectiveProfileId]:
      fn(currentState)
  };
});


}

async function toggle(
  array: keyof State,
  id: string,
  title?: Title
) {
  console.log(
    "TOGGLE CLICKED:",
    array,
    id,
    effectiveProfileId
  );

  if (!effectiveProfileId) {
    return;
  }

  let libraryItemId = id;

  try {
    if (
      title &&
      id.startsWith("tmdb-")
    ) {
      const ensuredTitle =
        await ensureTMDBLibraryItem(
          title
        );

      libraryItemId =
        ensuredTitle.id;
    }

    const currentState =
      states[effectiveProfileId] || {
        watched: [],
        watchlist: [],
        rewatch: []
      };

    const exists =
      currentState[array].includes(
        libraryItemId
      );

    const endpoint =
      array === "watched"
        ? "/api/watch-history"
        : array === "watchlist"
          ? "/api/watchlist"
          : "/api/rewatch";

    const sessionId =
      localStorage.getItem(
        "sx-session-token"
      );

    const response =
      await fetch(
        exists
          ? `${endpoint}?profileId=${encodeURIComponent(
              effectiveProfileId
            )}&libraryItemId=${encodeURIComponent(
              libraryItemId
            )}`
          : endpoint,
        {
          method: exists
            ? "DELETE"
            : "POST",

          headers: {
            "Content-Type":
              "application/json",

            ...(sessionId
              ? {
                  Authorization:
                    `Bearer ${sessionId}`
                }
              : {})
          },

          ...(exists
            ? {}
            : {
                body: JSON.stringify({
                  profileId:
                    effectiveProfileId,
                  libraryItemId:
                    libraryItemId
                })
              })
        }
      );

    if (!response.ok) {
      throw new Error(
        "Failed to update media state"
      );
    }

    updateState(current => ({
      ...current,

   [array]: exists
  ? current[array].filter(
      item =>
        item !==
        libraryItemId
    )
  : [
      ...current[array],
      libraryItemId
    ]
    }));

  
     
  } catch (error) {
    console.error(
      "Failed to update media state:",
      error
    );
  }
}

/* =======================================================
HIDE JUST ADDED / REMOVE TITLE
======================================================= */

async function hideJustAddedTitle(
  id: string
) {
  const sessionId =
    localStorage.getItem(
      "sx-session-token"
    );

  const parts =
    id.split("-");

  const mediaType =
    parts[1] === "tv"
      ? "tv"
      : "movie";

  const tmdbId =
    Number(
      parts.slice(2).join("-")
    );

  if (!Number.isFinite(tmdbId)) {
    return;
  }

  try {
    const response =
      await fetch(
        "https://streamix.gaintrainstrong.workers.dev/api/tmdb/just-added/hide",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            ...(sessionId
              ? {
                  Authorization:
                    `Bearer ${sessionId}`
                }
              : {})
          },
          body: JSON.stringify({
  tmdbId,
  mediaType,
  titleData:
    justAdded.find(
      title =>
        title.id === id
    )
})
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Unable to hide this title."
      );
    }

    const hiddenTitle =
      justAdded.find(
        title =>
          title.id === id
      );

    setJustAdded(
      current =>
        current.filter(
          title =>
            title.id !== id
        )
    );

    if (hiddenTitle) {
      setHiddenJustAdded(
        current =>
          current.some(
            item =>
              item.id === id
          )
            ? current
            : [
                ...current,
                hiddenTitle
              ]
      );
    }
  } catch (error) {
    console.error(
      "Failed to hide Just Added title:",
      error
    );
  }
}
  
async function removeTitle(
  id: string
) {
try {
  await fetch(
    `/api/library?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE"
    }
  );
} catch (error) {
  console.error(
    "Failed to delete media:",
    error
  );
}

setLibrary(currentLibrary =>
  currentLibrary.filter(
    title =>
      title.id !== id
  )
);

setStates(currentStates => {
  const nextStates = {
    ...currentStates
  };

  Object.keys(
    nextStates
  ).forEach(
    profileKey => {
      const profileState =
        nextStates[
          profileKey
        ];

      nextStates[
        profileKey
      ] = {
        watched:
          profileState.watched.filter(
            item =>
              item !== id
          ),
        watchlist:
          profileState.watchlist.filter(
            item =>
              item !== id
          ),
        rewatch:
          profileState.rewatch.filter(
            item =>
              item !== id
          )
      };
    }
  );

  return nextStates;
});

setReminders(current =>
  current.filter(
    reminder =>
      reminder.titleId !==
      id
  )
);

setScheduled(current =>
  current.filter(
    item =>
      item.titleId !==
      id
  )
);

setHeroSettings(current => {
  if (
    current.titleId !== id
  ) {
    return current;
  }

  return {
    ...current,
    titleId: null
  };
});


}

async function showJustAddedAgain(
  id: string
) {
  const sessionId =
    localStorage.getItem(
      "sx-session-token"
    );

  const parts =
    id.split("-");

  const mediaType =
    parts[1] === "tv"
      ? "tv"
      : "movie";

  const tmdbId =
    Number(
      parts.slice(2).join("-")
    );

  if (!Number.isFinite(tmdbId)) {
    return;
  }

  try {
    const response =
      await fetch(
        "https://streamix.gaintrainstrong.workers.dev/api/tmdb/just-added/show",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            ...(sessionId
              ? {
                  Authorization:
                    `Bearer ${sessionId}`
                }
              : {})
          },
          body: JSON.stringify({
            tmdbId,
            mediaType
          })
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Unable to show this title again."
      );
    }

      const title =
      hiddenJustAdded.find(
        item =>
          item.id === id
      );
     
   setHiddenJustAdded(
  current =>
    current.filter(
      title =>
        title.id !== id
    )
);

if (title) {
  setJustAdded(
    current => {
      const withoutDuplicate =
        current.filter(
          item =>
            item.id !== id
        );

      return [
        ...withoutDuplicate,
        title
      ];
    }
  );
}
  } catch (error) {
    console.error(
      "Failed to show Just Added title again:",
      error
    );
  }
}
   
/* =======================================================
PROFILE MANAGEMENT
======================================================= */

async function addProfile(
  name: string,
  avatar: string
) {
  try {
    const sessionId =
      localStorage.getItem(
        "sx-session-token"
      );

    const response = await fetch(
      "https://streamix.gaintrainstrong.workers.dev/api/profiles",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          ...(sessionId
            ? {
                Authorization:
                  `Bearer ${sessionId}`
              }
            : {})
        },
        body: JSON.stringify({
          id: uid(),
          name:
            name.trim() ||
            "New Profile",
          avatar:
            avatar || "🙂"
        })
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Failed to create profile."
      );
    }

    setProfiles(current => [
      ...current,
      data
    ]);

    setStates(current => ({
      ...current,
      [data.id]: {
        watched: [],
        watchlist: [],
        rewatch: []
      }
    }));

    setEditing(null);
  } catch (error) {
    console.error(
      "Failed to create profile:",
      error
    );
  }
}

/* =======================================================
REORDER PROFILES
======================================================= */

function reorderProfiles(
draggedId: string,
targetId: string,
position:
| "before"
| "after"
) {
if (
draggedId === targetId ||
!isAdmin ||
draggedId === "admin" ||
targetId === "admin"
) {
return;
}


setProfiles(current => {
  const next = [...current];

  const draggedIndex =
    next.findIndex(
      profile =>
        profile.id ===
        draggedId
    );

  if (
    draggedIndex === -1
  ) {
    return current;
  }

  const [
    draggedProfile
  ] = next.splice(
    draggedIndex,
    1
  );

  const targetIndex =
    next.findIndex(
      profile =>
        profile.id ===
        targetId
    );

  if (
    targetIndex === -1
  ) {
    return current;
  }

  const insertIndex =
    position === "before"
      ? targetIndex
      : targetIndex + 1;

  next.splice(
    insertIndex,
    0,
    draggedProfile
  );

  return next;
});


}

/* =======================================================
START PROFILE DRAG
======================================================= */

function startProfileDrag(
event: React.PointerEvent,
profileIdToDrag: string
) {
if (
!isAdmin ||
profileIdToDrag === "admin"
) {
return;
}


event.preventDefault();
event.stopPropagation();

setDraggedProfileId(
  profileIdToDrag
);

setDragOverProfileId(null);

setDragPosition("after");

setDragPointerId(
  event.pointerId
);


}

/* =======================================================
LOGIN SCREEN
======================================================= */
if (
  profileId === null &&
  !sessionRestoring
) {
return ( <div className="app"> <main> <div className="login-screen"> <div className="login-container">


          <div className="login-heading">

            <img
              className="login-logo"
              src="/streamix-logo.png"
              alt="Streamix"
            />

            <h1>
              Who's watching?
            </h1>

            <p className="muted">
              Choose a profile to
              continue.
            </p>

          </div>

          <div className="profiles">

{orderedProfiles
  .filter(
    item =>
      isAdminUser ||
      item.id !== "testing"
  )
  .map(
     
            item => (
                  <div
                    className="profile-row"
                    key={item.id}
                  >

                    <button
                      onClick={() =>
                        setLoginProfile(
                          item
                        )
                      }
                      style={{
                        width:
                          "100%"
                      }}
                    >

                      <span className="avatar">
                        {item.avatar}
                      </span>

                      <span>
                        {item.name}
                      </span>

                    </button>

                  </div>
                )
              )}

          </div>

          <p className="muted login-help">
            Select your profile
            to sign in.
          </p>

        </div>
      </div>
    </main>

    {loginProfile && (
      <ProfileLogin
        profile={
          loginProfile
        }
   onClose={() => {
  setShowReminder(null);
  setShowReminderList(true);
}}
        onSuccess={() => {
          handleLoginSuccess(
            loginProfile.id
          );

          setLoginProfile(
            null
          );
        }}
        onSetPassword={password => {
          setProfiles(
            current =>
              current.map(
                item =>
                  item.id ===
                  loginProfile.id
                    ? {
                        ...item,
                        password
                      }
                    : item
              )
          );
        }}
      />
    )}

  </div>
);


}
   
/* =======================================================
MAIN APP
======================================================= */

return ( <div className="app">
 
  {/* HEADER */}

<header>

  <div className="logo">
    <img
      src="/streamix-logo.png"
      alt="Streamix"
    />
  </div>

  <div className="header-right">

    <button
      className="profile-pill"
      onClick={() =>
        setShowProfile(true)
      }
    >
      <span>
        {isViewingAs
          ? "👑"
          : profile?.avatar}
      </span>

      <span>
        {isViewingAs
          ? "Admin"
          : profile?.name}
      </span>

      <ChevronDown
        size={16}
      />
    </button>

    {isViewingAs && (
      <span className="admin-viewing-status">
        <span className="status-dot" />

        <span className="viewing-label-desktop">
          VIEWING AS
        </span>

        <span className="viewing-label-mobile">
          AS
        </span>

        {profiles.find(
          item =>
            item.id === viewingAs
        )?.name || "user"}
      </span>
    )}

    {profileId === "testing" && (
      <button
        className="admin-badge"
        onClick={() => {
          const adminSession =
            localStorage.getItem(
              "sx-admin-session-token"
            );

          if (adminSession) {
            localStorage.setItem(
              "sx-session-token",
              adminSession
            );

            localStorage.removeItem(
              "sx-admin-session-token"
            );
          }

          setViewingAs(null);

          localStorage.removeItem(
            "sx-viewing-as"
          );

          localStorage.removeItem(
            "sx-testing-active"
          );

          setProfileId(
            "admin"
          );

          setTab("library");
          setFilter("all");
          setKind("all");
          setMenu(false);
        }}
        aria-label="Back to Admin"
      >
        {isMobile
          ? "← ADMIN"
          : "← BACK TO ADMIN"}
      </button>
    )}

    {isAdmin &&
      !isViewingAs && (
        <button
          className="admin-badge"
          onClick={() =>
            setMenu(
              current =>
                !current
            )
          }
        >
          SETTINGS
        </button>
      )}

  <button
  className="notification-bell"
  onClick={() =>
    setShowReminderList(true)
  }
  aria-label="Notifications"
  title="Notifications"
>
  <Bell size={18} />
</button>

<button
  className="admin-badge"
  onClick={signOut}
>
  LOG OUT
</button>

    {menu &&
      isAdmin && (
        <div className="admin-menu">

          <button
            onClick={() => {
              setShowAdd(true);
              setMenu(false);
            }}
          >
            <Plus />
            Add media
          </button>

          <button
            onClick={() => {
              setShowHero(true);
              setMenu(false);
            }}
          >
            <Settings />
            Edit hero
          </button>

          <button
            onClick={() => {
              setShowDeleted(true);
              setMenu(false);
            }}
          >
            <Trash2 />
            Deleted profiles
          </button>

        </div>
      )}

  </div>
</header>

   {/* DETAILS */}

{showDetails && (
<DetailsView
  title={showDetails}
  initialDetails={showDetailsData}
  onClose={() => {
      window.history.pushState(
        {},
        "",
        window.location.pathname
      );

      setShowDetails(null);
    }}
    onDetails={openDetails}
  />
)}

    {!showDetails && (
  <>

  {/* HERO */}

  <section
    className="hero"
    style={
      hero &&
      hero.backdrop
        ? {
            backgroundImage:
              "linear-gradient(90deg, rgba(0,0,0,.92), rgba(0,0,0,.15)), url(" +
              hero.backdrop +
              ")",
            backgroundPosition:
              String(
                heroSettings.positionX
              ) +
              "% " +
              String(
                heroSettings.positionY
              ) +
              "%"
          }
        : {
            backgroundImage:
              "none"
          }
    }
  >

    <div className="hero-content">

{hero ? (
  <>
    <div className="eyebrow">
      FEATURED
    </div>

    <h1>
      {hero.name}
    </h1>

    <p>
      {hero.year} ·{" "}
      {hero.kind === "movie"
        ? "Movie"
        : "TV Show"}
    </p>

    <div className="hero-actions">
      <button
        type="button"
        className="hero-more-info-button"
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          openDetails(hero);
        }}
      >
        More Info →
      </button>

      <button
        type="button"
        className="poster-reminder-button"
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          setShowReminder(hero);
        }}
        aria-label={
          "Set reminder for " +
          hero.name
        }
        title="Remind me"
      >
        <Bell size={15} />
      </button>

      <button
        type="button"
        className="poster-list-button"
      onClick={event => {
  event.preventDefault();
  event.stopPropagation();

  const isOnWatchlist =
    state.watchlist.includes(hero.id);

  toggle(
    "watchlist",
    hero.id,
    hero
  );

  setHeroWatchlistMessage(
    isOnWatchlist
      ? "Removed from watchlist"
      : "Added to watchlist"
  );

  setTimeout(() => {
    setHeroWatchlistMessage("");
  }, 2000);
}}
        aria-label={
          state.watchlist.includes(hero.id)
            ? "Remove " +
              hero.name +
              " from Watchlist"
            : "Add " +
              hero.name +
              " to Watchlist"
        }
        title={
          state.watchlist.includes(hero.id)
            ? "Remove from Watchlist"
            : "Add to Watchlist"
        }
      >
      <Heart
  size={15}
  fill={
    state.watchlist.includes(hero.id)
      ? "currentColor"
      : "none"
  }
/>
      </button>

        {heroWatchlistMessage && (
      <div className="hero-watchlist-message">
        {heroWatchlistMessage}
      </div>
    )}
    </div>
    
    {isAdmin && (
      <button
        className="ghost"
        onClick={() =>
          setShowHero(true)
        }
      >
        Edit Hero
      </button>
    )}
  </>
) : libraryLoading ? (
  <></>
) : library.length === 0 ? (
  <>
    <h1>
      Your library is empty
    </h1>

    {isAdmin && (
      <button
        className="ghost"
        onClick={() =>
          setShowAdd(true)
        }
      >
        Add your first
        title
      </button>
    )}
  </>
) : (
  <></>
)}

    </div>

  </section>

  {/* MAIN */}

  <main>


{/* =======================================================
LIBRARY CONTROLS
======================================================= */}

{tab === "library" && (
  <>
    <div className="toolbar">

      <div className="filters">

        <button
          className={
            filter === "watchlist"
              ? "selected"
              : ""
          }
          onClick={() => {
            setTab("library");

            if (filter === "watchlist") {
              setFilter("all");
              setFilterClicked(false);
            } else {
              setFilter("watchlist");
              setFilterClicked(true);
            }

            setKind("all");
            setKindClicked(false);
            setJustAddedView("visible");
          }}
        >
          Watchlist
        </button>

        <button
          className={
            filter === "watched"
              ? "selected"
              : ""
          }
          onClick={() => {
            setTab("library");

            if (filter === "watched") {
              setFilter("all");
              setFilterClicked(false);
            } else {
              setFilter("watched");
              setFilterClicked(true);
            }

            setKind("all");
            setKindClicked(false);
            setJustAddedView("visible");
          }}
        >
          Watched
        </button>

        <button
          className={
            filter === "rewatch"
              ? "selected"
              : ""
          }
          onClick={() => {
            setTab("library");

            if (filter === "rewatch") {
              setFilter("all");
              setFilterClicked(false);
            } else {
              setFilter("rewatch");
              setFilterClicked(true);
            }

            setKind("all");
            setKindClicked(false);
            setJustAddedView("visible");
          }}
        >
          Re-watch
        </button>

      </div>

      <div className="search">

        <Search size={18} />

        <input
          value={q}
          onChange={event =>
            setQ(event.target.value)
          }
          placeholder="Search library"
        />

      </div>

    </div>

{/* FORMAT + SORT */}

<div className="format">
  <button
    className={
      kind === "all" &&
      kindClicked
        ? "selected"
        : ""
    }
    onClick={() => {
      setKind("all");
      setKindClicked(true);
      setFilter("all");
      setFilterClicked(false);
      setQ("");
      setHiddenSearch("");
      setJustAddedView("visible");
    }}
  >
    All
  </button>

  <button
    className={
      kind === "movie"
        ? "selected"
        : ""
    }
    onClick={() => {
      setKind("movie");
      setKindClicked(true);
      setFilter("all");
      setFilterClicked(false);
      setQ("");
      setHiddenSearch("");
      setJustAddedView("visible");
    }}
  >
<Film size={15} />
<span className="mobile-hide-label">Movies</span>
  </button>

  <button
    className={
      kind === "tv"
        ? "selected"
        : ""
    }
    onClick={() => {
      setKind("tv");
      setKindClicked(true);
      setFilter("all");
      setFilterClicked(false);
      setQ("");
      setHiddenSearch("");
      setJustAddedView("visible");
    }}
  >
    <Tv size={15} />
<span className="mobile-hide-label">TV Shows</span>
  </button>

  {isAdmin && (
    <button
      type="button"
      className={
        "view-hidden-btn" +
        (justAddedView === "hidden"
          ? " selected"
          : "")
      }
      onClick={() => {
        setFilter("all");
        setFilterClicked(false);
        setKind("all");
        setKindClicked(false);

        setJustAddedView(current =>
          current === "visible"
            ? "hidden"
            : "visible"
        );
      }}
    >
      {justAddedView === "hidden"
        ? "Back to Just Added"
        : "View Hidden"}
    </button>
  )}

  <select
    className="sort-select"
    value={sort}
    onChange={event =>
      setSort(
        event.target.value as SortOption
      )
    }
    aria-label="Sort library"
  >
    <option
      value="default"
      disabled
    >
      Sort by
    </option>

    <option value="just-added">
      Just Added
    </option>

    <option value="popularity">
      Most Popular
    </option>

    <option value="year-desc">
      Newest release
    </option>

    <option value="year-asc">
      Oldest release
    </option>

    <option value="name-asc">
      Name A–Z
    </option>

    <option value="name-desc">
      Name Z–A
    </option>
  </select>

     {sort !== "default" && (
  <button
    type="button"
    className="clear-filters-button"
    onClick={() => {
      setSort("default");
    }}
    aria-label="Clear sort"
    title="Clear sort"
  >
    ×
  </button>
)}
   </div>
     
     
{isAdmin &&
  justAddedView === "hidden" && (
    <div className="hidden-search">
      <Search size={18} />

      <input
        value={hiddenSearch}
        onChange={event =>
          setHiddenSearch(
            event.target.value
          )
        }
        placeholder="Search hidden movies and TV shows"
        aria-label="Search hidden movies and TV shows"
      />

    </div>
  )}

</>
)}

{/* LIBRARY */}

<div className="grid">

{libraryLoading ? (
  <></>
) : visible.length > 0 ? (
    visible.map(title => (
      <Card
      key={`${kind}-${title.id}`}
        t={title}
        st={state}
        isAdmin={isAdmin}
        hiddenJustAdded={
          isAdmin &&
          sort === "just-added" &&
          justAddedView === "hidden"
        }
        onWatch={() =>
          toggle(
            "watched",
            title.id,
            title
          )
        }
        onList={() =>
          toggle(
            "watchlist",
            title.id,
            title
          )
        }
        onRewatch={() =>
          toggle(
            "rewatch",
            title.id,
            title
          )
        }
        onRemove={() =>
          sort === "just-added"
            ? justAddedView === "hidden"
              ? showJustAddedAgain(title.id)
              : hideJustAddedTitle(title.id)
            : removeTitle(title.id)
        }
        onReminder={() =>
          setShowReminder(title)
        }
        onSchedule={() =>
          setShowSchedule(title)
        }
        onDetails={() =>
          openDetails(title)
        }
      />
    ))
  ) : library.length > 0 ? (
    <div className="empty">
      Nothing here yet.
    </div>
  ) : (
    <></>
  )}

</div>

{visible.length > 0 &&
  (
    q.trim()
      ? tmdbSearchHasMore
      : sort === "just-added"
        ? (
            !justAddedLoading &&
            (
              justAddedView === "hidden"
                ? hiddenJustAddedLimit <
                  hiddenJustAdded.length
                : justAddedLimit <
                  justAdded.length
            )
          )
        : tmdbCatalogHasMore &&
          tmdbCatalogLimit < 200
  ) && (
     
    <button
      type="button"
      className="show-more-button"
      onClick={event => {
        event.currentTarget.blur();

        if (q.trim()) {
          loadNextTMDBSearchPage();
          return;
        }

        if (sort === "just-added") {
          if (
            justAddedView ===
            "hidden"
          ) {
            setHiddenJustAddedLimit(
              current =>
                Math.min(
                  current +
                    (isMobile
                      ? 20
                      : 40),
                  hiddenJustAdded.length
                )
            );
          } else {
            setJustAddedLimit(
              current =>
                Math.min(
                  current + 40,
                  justAdded.length
                )
            );
          }

          return;
        }

        loadNextTMDBCatalogPage();
      }}
    >
      Show more
    </button>
  )}
</main>

</>
)}
     
  {/* TODAY'S RECOMMENDATION */}

  {showReco &&
    recommendation && (
      <Modal
        title="Today's Reco"
        onClose={
          closeRecommendation
        }
      >
        <div className="reco">

          <img
            src={
              recommendation.poster
            }
            alt={
              recommendation.name
            }
          />

          <div>

            <div className="reco-label">
              FROM YOUR WATCHLIST
            </div>

            <h2>
              {
                recommendation.name
              }
            </h2>

            <p>
              {
                recommendation.year
              }{" "}
              ·{" "}
              {recommendation.kind ===
              "movie"
                ? "Movie"
                : "TV Show"}
            </p>

            {recommendation.overview && (
              <p>
                {
                  recommendation.overview
                }
              </p>
            )}

          </div>

        </div>
      </Modal>
    )}

{/* PROFILES */}

{showProfile && (
  <Modal
    title="Profiles"
    compact
    onClose={() =>
      setShowProfile(
        false
      )
    }
  >

    <div className="profiles">

      {orderedProfiles.map(
        item => {

          const isDragging =
            draggedProfileId ===
            item.id;

          const isDropTarget =
            dragOverProfileId ===
            item.id;

          const dropClass =
            isDropTarget
              ? dragPosition ===
                "before"
                ? " drop-before"
                : " drop-after"
              : "";

          return (
            <div
              className={
                "profile-row" +
                (isDragging
                  ? " dragging"
                  : "") +
                dropClass
              }
              key={item.id}
              data-profile-id={
                item.id
              }
              style={{
                opacity:
                  isDragging
                    ? 0.45
                    : 1
              }}
            >

              <button
                onClick={() => {
                  if (
                    draggedProfileId
                  ) {
                    return;
                  }

                  if (
                    item.id ===
                    effectiveProfileId
                  ) {
                    setShowProfile(
                      false
                    );
                    return;
                  }

if (
  profileId === "testing" &&
  item.id === "admin"
) {
  const adminSession =
    localStorage.getItem(
      "sx-admin-session-token"
    );

  if (adminSession) {
    localStorage.setItem(
      "sx-session-token",
      adminSession
    );
  }

  localStorage.removeItem(
    "sx-testing-active"
  );

  setProfileId(
    "admin"
  );

  setViewingAs(
    null
  );

  setShowProfile(
    false
  );

  return;
}

   if (
    isAdminUser
 ) {
if (
  item.id ===
  "admin"
) {
  localStorage.removeItem(
    "sx-testing-active"
  );

  setViewingAs(
    null
  );

  localStorage.removeItem(
    "sx-viewing-as"
  );

  setProfileId(
    "admin"
  );
} else if (
  item.id ===
  "testing"
) {
  localStorage.setItem(
    "sx-testing-active",
    "true"
  );

  setProfileId(
    "testing"
  );

  setViewingAs(
    null
  );

  localStorage.removeItem(
    "sx-viewing-as"
  );

  setShowProfile(
    false
  );

  return;
}
                    else {
                      setViewingAs(
                        item.id
                      );

                      localStorage.setItem(
                        "sx-viewing-as",
                        item.id
                      );

                      setProfileId(
                        "admin"
                      );
                    }

                    setShowProfile(
                      false
                    );

                    return;
                  }

                  setLoginProfile(
                    item
                  );

                  setShowProfile(
                    false
                  );
                }}
                className={
                  item.id ===
                  effectiveProfileId
                    ? "current"
                    : ""
                }
              >

                <span className="avatar">
                  {
                    item.avatar
                  }
                </span>

                <span>
                  {item.name}
                </span>

                {item.id ===
                  effectiveProfileId && (
                  <Check
                    size={18}
                  />
                )}

              </button>

              <button
                className="icon"
                disabled={
                  !isAdminUser &&
                  item.id !==
                    profileId
                }
                onClick={() => {
                  if (
                    !isAdminUser &&
                    item.id !==
                      profileId
                  ) {
                    return;
                  }

                  setEditing(
                    item
                  );

                  setShowProfile(
                    false
                  );
                }}
                aria-label={
                  item.id ===
                    effectiveProfileId ||
                  isAdminUser
                    ? "Profile settings"
                    : "Switch to this profile to edit settings"
                }
                title={
                  item.id ===
                    effectiveProfileId ||
                  isAdminUser
                    ? "Profile settings"
                    : "Switch to this profile to edit settings"
                }
              >
                <Settings
                  size={17}
                />
              </button>

         {isAdmin &&
  item.id !== "admin" &&
  item.id !== "testing" && (
                  <div
                    className="profile-drag-handle"
                    onPointerDown={event =>
                      startProfileDrag(
                        event,
                        item.id
                      )
                    }
                    role="button"
                    tabIndex={0}
                    aria-label={
                      "Drag to reorder " +
                      item.name
                    }
                    title="Drag to reorder"
                  >
                    <GripVertical
                      size={20}
                    />
                  </div>
                )}

              {isDropTarget && (
                <div
                  className={
                    dragPosition ===
                    "before"
                      ? "drop-label drop-label-before"
                      : "drop-label drop-label-after"
                  }
                >
                  {dragPosition ===
                  "before"
                    ? "Drop above"
                    : "Drop below"}
                </div>
              )}

            </div>
          );
        }
      )}

      {isAdmin && (
        <button
          className="add-profile"
          onClick={() => {
            setEditing({
              id: "new",
              name: "",
              avatar:
                "🙂"
            });

            setShowProfile(
              false
            );
          }}
        >
          <Plus />
          Add Profile
        </button>
      )}

    </div>
  </Modal>
   )}

   {showReminderList && (
  <Modal
    title="Reminders"
    onClose={() =>
      setShowReminderList(false)
    }
  >
 {console.log(
  "NOTIFICATIONS POPUP REMINDER:",
  {
    id: reminders[0]?.id,
    title: reminders[0]?.title,
    posterPath: reminders[0]?.posterPath,
    titleId: reminders[0]?.titleId,
    date: reminders[0]?.date,
    time: reminders[0]?.time
  }
)}
    {reminders.length === 0 ? (
      <p className="muted">
      You have no notifications scheduled.
      </p>
    ) : (
      <div>
      {reminders.map(reminder => (
  <div
    key={reminder.id}
    className="notification-item"
  >
    {reminder.posterPath && (
   <img
  src={`https://image.tmdb.org/t/p/w185${reminder.posterPath}`}
  alt={reminder.title}
  className="notification-poster"
/>
    )}

    <div className="notification-item-info">
      <strong>
        {reminder.title ||
          "Unknown title"}
      </strong>

      <span>
        {reminder.date}{" "}
        {reminder.time}
      </span>
    </div>

    <div className="notification-item-actions">
     <button
  type="button"
onClick={() => {
  setShowReminder({
    id: reminder.id,
    profileId: reminder.profileId,
    titleId: reminder.titleId,
    date: reminder.date,
    time: reminder.time,
    method: reminder.method
  });
setShowReminderList(false);
}}
>
  Edit
</button>

    <button
  type="button"
  onClick={async () => {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this notification?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const sessionId =
        localStorage.getItem(
          "sx-session-token"
        );

      const response =
        await fetch(
          `/api/reminders?profileId=${encodeURIComponent(
            reminder.profileId
          )}&id=${encodeURIComponent(
            reminder.id
          )}`,
          {
            method: "DELETE",
            headers: {
              ...(sessionId
                ? {
                    Authorization:
                      `Bearer ${sessionId}`
                  }
                : {})
            }
          }
        );

      if (!response.ok) {
        throw new Error(
          "Failed to delete reminder."
        );
      }

      setReminders(
        current =>
          current.filter(
            item =>
              item.id !==
              reminder.id
          )
      );
    } catch (error) {
      console.error(
        "Failed to delete reminder:",
        error
      );
    }
  }}
>
  Delete
</button>
    </div>
  </div>
))}
      </div>
    )}
  </Modal>
)}
   
  {/* PROFILE LOGIN */}

  {loginProfile && (
    <ProfileLogin
      profile={
        loginProfile
      }
      onClose={() =>
        setLoginProfile(
          null
        )
      }
      onSuccess={() => {
        handleLoginSuccess(
          loginProfile.id
        );

        setLoginProfile(
          null
        );
      }}
      onSetPassword={password => {
        setProfiles(
          current =>
            current.map(
              item =>
                item.id ===
                loginProfile.id
                  ? {
                      ...item,
                      password
                    }
                  : item
            )
        );
      }}
    />
  )}

  {/* PROFILE SETTINGS */}

  {editing && (
    <ProfileEditor
      profile={
        editing.id ===
        "new"
          ? null
          : editing
      }
      onClose={() =>
        setEditing(null)
      }
      onSave={(
        name,
        avatar
      ) => {
        if (
          editing.id ===
          "new"
        ) {
          addProfile(
            name,
            avatar
          );

          return;
        }

        setProfiles(
          current =>
            current.map(
              item =>
                item.id ===
                editing.id
                  ? {
                      ...item,
                      name,
                      avatar
                    }
                  : item
            )
        );

        setEditing(null);
      }}
      adminOverride={
        isAdminUser
      }
      onChangePassword={async password => {
        if (editing.id === "new") {
          return;
        }

        if (!isAdminUser) {
          throw new Error(
            "Only Admin can reset a profile password."
          );
        }

        const sessionId =
          localStorage.getItem(
            "sx-session-token"
          );

        const response =
          await fetch(
            "https://streamix.gaintrainstrong.workers.dev/api/auth/admin-reset-password",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                ...(sessionId
                  ? {
                      Authorization:
                        `Bearer ${sessionId}`
                    }
                  : {})
              },
              body: JSON.stringify({
                profileId:
                  editing.id,
                newPassword:
                  password
              })
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to reset password."
          );
        }
      }}
      onDelete={
        editing.id ===
        "new"
          ? undefined
          : async () => {
              const deletedProfileId =
                editing.id;

              try {
                const sessionId =
                  localStorage.getItem(
                    "sx-session-token"
                  );

                const response =
                  await fetch(
                    "https://streamix.gaintrainstrong.workers.dev/api/profiles?id=" +
                      encodeURIComponent(
                        deletedProfileId
                      ),
                    {
                      method: "DELETE",
                      headers: {
                        ...(sessionId
                          ? {
                              Authorization:
                                `Bearer ${sessionId}`
                            }
                          : {})
                      }
                    }
                  );

                const data =
                  await response.json();

                console.log(
                  "DELETE PROFILE:",
                  response.status,
                  JSON.stringify(data)
                );

                if (!response.ok) {
                  throw new Error(
                    data?.error ||
                      "Failed to delete profile."
                  );
                }

                setProfiles(
                  current =>
                    current.filter(
                      item =>
                        item.id !==
                        deletedProfileId
                    )
                );

                setDeletedProfiles(
                  current => {
                    const deletedProfile =
                      profiles.find(
                        item =>
                          item.id ===
                          deletedProfileId
                      );

                    if (
                      !deletedProfile ||
                      current.some(
                        item =>
                          item.id ===
                          deletedProfileId
                      )
                    ) {
                      return current;
                    }

                    return [
                      ...current,
                      deletedProfile
                    ];
                  }
                );

                setStates(
                  current => {
                    const next = {
                      ...current
                    };

                    delete next[
                      deletedProfileId
                    ];

                    return next;
                  }
                );

                if (
                  deletedProfileId ===
                  profileId
                ) {
                  signOut();
                } else {
                  setViewingAs(
                    null
                  );

                  setEditing(
                    null
                  );
                }
              } catch (error) {
                console.error(
                  "Failed to delete profile:",
                  error
                );
              }
            }
      }
    />
  )}

  {/* ADD MEDIA */}

  {showAdd && (
    <AddTitle
      library={library}
      onClose={() =>
        setShowAdd(false)
      }
      onAdd={async title => {
        const sessionId =
          localStorage.getItem(
            "sx-session-token"
          );

        const response =
          await fetch(
            "/api/library",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                ...(sessionId
                  ? {
                      Authorization:
                        `Bearer ${sessionId}`
                    }
                  : {})
              },
              body: JSON.stringify({
                tmdb_id: Number(
                  title.id.replace(
                    `tmdb-${title.kind}-`,
                    ""
                  )
                ),
                media_type:
                  title.kind === "movie"
                    ? "movie"
                    : "tv",
                title:
                  title.name,
                poster_path:
                  title.poster
                    ? title.poster.replace(
                        "https://image.tmdb.org/t/p/w500",
                        ""
                      )
                    : null,
                backdrop_path:
                  title.backdrop
                    ? title.backdrop.replace(
                        "https://image.tmdb.org/t/p/w1280",
                        ""
                      )
                    : null,
                overview:
                  title.overview || null,
                release_date:
                  title.year
                    ? `${title.year}-01-01`
                    : null,
                vote_average:
                  null
              })
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Failed to save media."
          );
        }

        setLibrary(current => [
          ...current,
          {
            ...title,
            id: data.id
          }
        ]);
      }}
    />
  )}


  {/* REMINDER */}

{showReminder && (
  <ReminderModal
    title={
      showReminder
    }
    onClose={() => {
      setShowReminder(null);
      setShowReminderList(true);
    }}
onSave={async (
  date,
  time,
  method
) => {
  if (
    method === "calendar" ||
    method === "both"
  ) {
    addReminderToCalendar(
      showReminder,
      date,
      time
    );
  }

if (!profileId) {
  return;
}

const isEditingReminder =
  "date" in showReminder &&
  "time" in showReminder;

if (
  !isEditingReminder &&
  reminders.some(
    reminder =>
      reminder.profileId === profileId &&
      reminder.titleId === showReminder.id
  )
) {
  window.alert(
    "You already have a notification scheduled for this title."
  );
  return;
}

try {
    const sessionId =
      localStorage.getItem(
        "sx-session-token"
      );

const response =
  await fetch(
    "/api/reminders",
    {
      method: isEditingReminder
        ? "PUT"
        : "POST",
      headers: {
        "Content-Type":
          "application/json",
        ...(sessionId
          ? {
              Authorization:
                `Bearer ${sessionId}`
            }
          : {})
      },
      body: JSON.stringify(
        isEditingReminder
          ? {
              id:
                showReminder.id,
              profileId,
              reminderDate:
                date,
              reminderTime:
                time
            }
          : {
              profileId,
              libraryItemId:
                showReminder.id,
              reminderDate:
                date,
              reminderTime:
                time
            }
      )
    }
  );

const data =
  await response.json();

if (!response.ok) {
  throw new Error(
    data?.error ||
      "Failed to save reminder."
  );
}

  if (isEditingReminder) {
  setReminders(
    current =>
      current.map(
        reminder =>
          reminder.id ===
          showReminder.id
            ? {
                ...reminder,
                date,
                time,
                method
              }
            : reminder
      )
  );
} else {
  setReminders(
    current => [
      ...current,
      {
        id: data.id,
        profileId,
        titleId:
          showReminder.id,
        date,
        time,
        method,
        title:
          showReminder.name,
        posterPath:
          showReminder.poster
            ? showReminder.poster.replace(
                "https://image.tmdb.org/t/p/w500",
                ""
              )
            : ""
      }
    ]
  );
}

    setShowReminder(
      null
    );
  } catch (error) {
    console.error(
      "Failed to save reminder:",
      error
    );
  }
}}
    />
  )}

  {/* SCHEDULE */}

  {showSchedule &&
    isAdmin && (
      <ScheduleModal
        title={
          showSchedule
        }
        profiles={profiles.filter(
          item =>
            item.id !==
            "admin"
        )}
        onClose={() =>
          setShowSchedule(
            null
          )
        }
        onSave={item => {
          setScheduled(
            current => [
              ...current,
              item
            ]
          );

          setShowSchedule(
            null
          );
        }}
      />
    )}

  {/* HERO EDITOR */}

  {showHero &&
    isAdmin && (
      <HeroModal
        hero={hero}
        library={library}
        settings={
          heroSettings
        }
        onClose={() =>
          setShowHero(
            false
          )
        }
   onSave={async settings => {
  try {
    const sessionId =
      localStorage.getItem(
        "sx-session-token"
      );

    const response =
      await fetch(
        "/api/hero-settings",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
            ...(sessionId
              ? {
                  Authorization:
                    `Bearer ${sessionId}`
                }
              : {})
          },
          body: JSON.stringify({
            libraryItemId:
              settings.titleId,
            positionX:
              settings.positionX,
            positionY:
              settings.positionY
          })
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Failed to save hero settings."
      );
    }

    setHeroSettings(
      settings
    );

    setShowHero(
      false
    );
  } catch (error) {
    console.error(
      "Failed to save hero settings:",
      error
    );
  }
}}
      />
    )}

 
{/* DELETED PROFILES */}

{showDeleted &&
  isAdmin && (
    <Modal
      title="Deleted Profiles"
      compact
      onClose={() =>
        setShowDeleted(false)
      }
    >
      {deletedProfilesLoading ? (
        <p className="muted">
          Loading...
        </p>
      ) : deletedProfiles.length === 0 ? (
        <p className="muted">
          No deleted profiles.
        </p>
      ) : (
        <div className="profiles deleted-profiles">
          {deletedProfiles.map(
            item => (
              <div
                className="profile-row deleted-profile-row"
                key={item.id}
              >
                <button
                  className="deleted-profile-name"
                  onClick={() => {
                    setShowDeleted(
                      false
                    );
                  }}
                >
                  <span className="avatar">
                    {item.avatar ||
                      "🙂"}
                  </span>

                  <span className="deleted-profile-name-text">
                    {item.name}
                  </span>
                </button>

                <div className="deleted-profile-actions">

                  <button
                    className="ghost"
                    type="button"
                    onClick={async () => {
                      try {
                        const sessionId =
                          localStorage.getItem(
                            "sx-session-token"
                          );

                        const response =
                          await fetch(
                            "https://streamix.gaintrainstrong.workers.dev/api/profiles/restore?id=" +
                              encodeURIComponent(
                                item.id
                              ),
                            {
                              method: "POST",
                              headers: sessionId
                                ? {
                                    Authorization:
                                      `Bearer ${sessionId}`
                                  }
                                : {}
                            }
                          );

                        if (
                          !response.ok
                        ) {
                          throw new Error(
                            "Failed to restore profile."
                          );
                        }

                        setDeletedProfiles(
                          current =>
                            current.filter(
                              p =>
                                p.id !==
                                item.id
                            )
                        );

                        setProfiles(
                          current => [
                            ...current,
                            item
                          ]
                        );
                      } catch (error) {
                        console.error(
                          "Failed to restore profile:",
                          error
                        );
                      }
                    }}
                  >
                    RESTORE
                  </button>

                  <button
                    className="ghost"
                    type="button"
                    onClick={async () => {
                      const confirmed =
                        window.confirm(
                          `Permanently delete "${item.name}"? This cannot be undone.`
                        );

                      if (!confirmed) {
                        return;
                      }

                      try {
                        const sessionId =
                          localStorage.getItem(
                            "sx-session-token"
                          );

                        const response =
                          await fetch(
                            "https://streamix.gaintrainstrong.workers.dev/api/profiles/delete-forever?id=" +
                              encodeURIComponent(
                                item.id
                              ),
                            {
                              method: "DELETE",
                              headers: sessionId
                                ? {
                                    Authorization:
                                      `Bearer ${sessionId}`
                                  }
                                : {}
                            }
                          );

                        if (
                          !response.ok
                        ) {
                          throw new Error(
                            "Failed to permanently delete profile."
                          );
                        }

                        setDeletedProfiles(
                          current =>
                            current.filter(
                              p =>
                                p.id !==
                                item.id
                            )
                        );
                      } catch (error) {
                        console.error(
                          "Failed to permanently delete profile:",
                          error
                        );
                      }
                    }}
                  >
                    DELETE FOREVER
                  </button>

                </div>
              </div>
            )
          )}
        </div>
      )}
    </Modal>
  )}


  {/* FOOTER */}

  <footer>

    <span>
      <Clock size={14} />

      {
        reminders.filter(
          reminder =>
            reminder.profileId ===
            effectiveProfileId
        ).length
      }{" "}
      reminder(s)
    </span>

    {isAdmin && (
      <span>
        {
          scheduled.length
        }{" "}
        scheduled reco(s)
      </span>
    )}

  </footer>

  {showScrollTop && (
    <button
      type="button"
      className="scroll-top-button"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        })
      }
      aria-label="Scroll to top"
    >
      <ArrowUp size={20} />
    </button>
  )}

</div>


);
}

/* =========================================================
PROFILE LOGIN
========================================================= */

function ProfileLogin({
  profile,
  onClose,
  onSuccess,
  onSetPassword
}: {
  profile: Profile;
  onClose: () => void;
  onSuccess: () => void;
  onSetPassword: (
    password: string
  ) => void;
}) {
  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [resetting, setResetting] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const isTesting =
    profile.id === "testing";

  const hasPassword =
    profile.id === "admin";

  async function handleLogin() {
    if (!password.trim()) {
      setError(
        "Please enter your password."
      );
      return;
    }

    try {
   const response = await fetch(
  "https://streamix.gaintrainstrong.workers.dev/api/auth/login",
  {
    method: "POST",
  headers: {
  "Content-Type":
    "application/json"
},
          body: JSON.stringify({
            profileId:
              profile.id,
            password
          })
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Incorrect password. Please try again."
        );
      }

      if (data.sessionId) {
        localStorage.setItem(
          "sx-session-token",
          data.sessionId
        );
      }

      onSuccess();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Incorrect password. Please try again."
      );
    }
  }

  async function handleTestingLogin() {
    try {
      const adminSession =
        localStorage.getItem(
          "sx-session-token"
        );

      if (!adminSession) {
        throw new Error(
          "Admin session could not be found."
        );
      }

      localStorage.setItem(
        "sx-admin-session-token",
        adminSession
      );

  const response = await fetch(
  "https://streamix.gaintrainstrong.workers.dev/api/auth/login",
  {
    method: "POST",
    headers: {
      "Content-Type":
        "application/json",
      Authorization:
        `Bearer ${adminSession}`
    },
          body: JSON.stringify({
            profileId: "testing"
          })
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to enter TESTING mode."
        );
      }

      if (data.sessionId) {
        localStorage.setItem(
          "sx-session-token",
          data.sessionId
        );
      }

      onSuccess();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to enter TESTING mode."
      );
    }
  }

  function handleSetPassword() {
    if (!password.trim()) {
      setError(
        "Please enter a password."
      );

      return;
    }

    onSetPassword(
      password
    );

    onSuccess();
  }

  function handleResetPassword() {
    if (!password.trim()) {
      setError(
        "Please enter a new password."
      );

      return;
    }

    onSetPassword(
      password
    );

    onSuccess();
  }

  return (
    <Modal
      title={
        isTesting
          ? "Testing Profile"
          : !hasPassword
          ? "Set Your Password"
          : resetting
          ? "Create a New Password"
          : "Profile Login"
      }
      onClose={
        onClose
      }
    >
      <div className="profile-login">

        <div className="profile-login-avatar">
          {profile.avatar}
        </div>

        <h3>
          {profile.name}
          {!isTesting &&
            "'s Profile"}
        </h3>

{isTesting ? (
  <>
    {error && (
      <p className="login-error">
        {error}
      </p>
    )}

    <button
      className="pink full"
      onClick={
        handleTestingLogin
      }
    >
      Enter Testing Mode
    </button>
  </>
        ) : !hasPassword ? (
          <>
            <p className="muted">
              Create a password for your profile.
              You'll use it whenever you log in.
            </p>

            <label>
              Password

              <div className="password-wrapper">

                <input
                  autoFocus
                  autoComplete="new-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={
                    password
                  }
                  onChange={event => {
                    setPassword(
                      event.target
                        .value
                    );

                    setError("");
                  }}
                  onKeyDown={event => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      handleSetPassword();
                    }
                  }}
                  placeholder="Create a password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      current =>
                        !current
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff
                      size={18}
                    />
                  ) : (
                    <Eye
                      size={18}
                    />
                  )}
                </button>

              </div>
            </label>

            {error && (
              <p className="login-error">
                {error}
              </p>
            )}

            <button
              className="pink full"
              onClick={
                handleSetPassword
              }
            >
              Set Password
            </button>
          </>
        ) : resetting ? (
          <>
            <p className="muted">
              Create a new password for your
              profile.
            </p>

            <label>
              New Password

              <div className="password-wrapper">

                <input
                  autoFocus
                  autoComplete="new-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={
                    password
                  }
                  onChange={event => {
                    setPassword(
                      event.target
                        .value
                    );

                    setError("");
                  }}
                  onKeyDown={event => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      handleResetPassword();
                    }
                  }}
                  placeholder="Create a new password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      current =>
                        !current
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff
                      size={18}
                    />
                  ) : (
                    <Eye
                      size={18}
                    />
                  )}
                </button>

              </div>
            </label>

            {error && (
              <p className="login-error">
                {error}
              </p>
            )}

            <button
              className="pink full"
              onClick={
                handleResetPassword
              }
            >
              Reset Password
            </button>

            <button
              className="ghost full"
              onClick={() => {
                setResetting(
                  false
                );

                setPassword("");
                setError("");
                setShowPassword(
                  false
                );
              }}
            >
              Back to Login
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Enter your password to continue.
            </p>

            <label>
              Password

              <div className="password-wrapper">

                <input
                  autoFocus
                  autoComplete="current-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={
                    password
                  }
                  onChange={event => {
                    setPassword(
                      event.target
                        .value
                    );

                    setError("");
                  }}
                  onKeyDown={event => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      handleLogin();
                    }
                  }}
                  placeholder="Enter password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      current =>
                        !current
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff
                      size={18}
                    />
                  ) : (
                    <Eye
                      size={18}
                    />
                  )}
                </button>

              </div>
            </label>

            {error && (
              <p className="login-error">
                {error}
              </p>
            )}

            <button
              className="pink full"
              onClick={
                handleLogin
              }
            >
              Log In
            </button>

            {profile.id !== "admin" && (
              <button
                className="forgot-password"
                onClick={() => {
                  setResetting(true);
                  setPassword("");
                  setError("");
                  setShowPassword(false);
                }}
              >
                Forgot password?
              </button>
            )}
          </>
        )}

      </div>
    </Modal>
  );
}
/* =========================================================
CARD
========================================================= */

function Card({
  t,
  st,
  isAdmin,
  hiddenJustAdded,
  onWatch,
  onList,
  onRewatch,
  onRemove,
  onReminder,
  onSchedule,
  onDetails
}: {
  t: Title;
  st: State;
  isAdmin: boolean;
  hiddenJustAdded?: boolean;
  onWatch: () => void;
  onList: () => void;
  onRewatch: () => void;
  onRemove: () => void;
  onReminder: () => void;
  onSchedule: () => void;
  onDetails: () => void;
}) {

  const [watchedClicked, setWatchedClicked] =
    useState(false);

  const [watchlistMessage, setWatchlistMessage] =
    useState("");

  const isOnWatchlist =
    st.watchlist.includes(t.id);

  const isWatched =
    watchedClicked ||
    st.watched.includes(t.id);

  const isRewatch =
    st.rewatch.includes(t.id);

  return (
    <article className="card">

      <div className="poster-wrap">

        <button
          type="button"
          className="poster-details-button"
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onDetails();
          }}
          aria-label={
            "View details for " +
            t.name
          }
        >
          <img
            src={t.poster.replace(
              "/w500/",
              "/w342/"
            )}
            alt={t.name}
            loading="lazy"
            decoding="async"
            onError={event => {
              event.currentTarget.src =
                "https://placehold.co/500x750/171717/ffffff?text=" +
                encodeURIComponent(t.name);
            }}
          />
        </button>

        <span className="kind">
          {t.kind === "movie"
            ? "MOVIE"
            : "TV"}
        </span>

        {!isAdmin && (
          <div className="poster-actions">

            <button
              type="button"
              className="poster-reminder-button"
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                onReminder();
              }}
              aria-label={
                "Set reminder for " +
                t.name
              }
              title="Remind me"
            >
              <Bell size={15} />
            </button>

            <button
              type="button"
              className="poster-list-button"
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();

                if (isOnWatchlist) {
                  onList();
                  setWatchlistMessage(
                    "Removed from watchlist"
                  );
                } else {
                  onList();
                  setWatchlistMessage(
                    "Added to watchlist"
                  );
                }

                setTimeout(() => {
                  setWatchlistMessage("");
                }, 2000);
              }}
              aria-label={
                isOnWatchlist
                  ? "Remove " +
                    t.name +
                    " from Watchlist"
                  : "Add " +
                    t.name +
                    " to Watchlist"
              }
              title={
                isOnWatchlist
                  ? "Remove from Watchlist"
                  : "Add to Watchlist"
              }
            >
            <Heart
          size={15}
          fill={
          isOnWatchlist
          ? "currentColor"
          : "none"
            }
          />
            </button>

          </div>
        )}

        {watchlistMessage && (
          <div className="watchlist-message">
            {watchlistMessage}
          </div>
        )}

        {isAdmin && (
          <button
            type="button"
            className="remove"
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
            }}
            title={
              hiddenJustAdded
                ? "Show Again"
                : "Hide from Just Added"
            }
            aria-label={
              hiddenJustAdded
                ? "Show Again"
                : "Hide " +
                  t.name
            }
            style={{
              position: "absolute",
              zIndex: 20,
              pointerEvents: "auto",
              cursor: "pointer"
            }}
          >
            {hiddenJustAdded ? (
              <Eye size={16} />
            ) : (
              <EyeOff size={16} />
            )}
          </button>
        )}

      </div>

      <div className="card-body">

        <h3>{t.name}</h3>

        <p>{t.year}</p>

        {!isAdmin && (
          <>

            <div className="actions">

              <button
                type="button"
                className={
                  isWatched
                    ? "on"
                    : ""
                }
                onClick={onWatch}
              >
                <span className="action-icon">
                  ✓
                </span>

                <span className="action-label">
                  {isWatched
                    ? "Watched"
                    : "Watched"}
                </span>
              </button>

              <button
                type="button"
                className={
                  isRewatch
                    ? "rewatch-action on"
                    : "rewatch-action"
                }
                onClick={onRewatch}
              >
                <span className="action-icon">
                  ↻
                </span>

                <span className="action-label">
                  Re-watch
                </span>
              </button>

            </div>

          </>
        )}

      </div>

    </article>
  );
}

/* =========================================================
   DETAILS VIEW
========================================================= */

function DetailsView({
  title,
  initialDetails,
  onClose,
  onDetails
}: {
  title: Title;
  initialDetails: any | null;
  onClose: () => void;
  onDetails: (title: Title) => void;
}) {
   
const [details, setDetails] =
  useState<any | null>(
    initialDetails
  );

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "auto"
    });
  }, [
    title.id,
    title.kind
  ]);


  const displayTitle =
    details?.title ||
    details?.name ||
    "Loading…";

  const releaseDate =
    details?.release_date ||
    details?.first_air_date ||
    "";

  const year =
    releaseDate
      ? releaseDate.slice(0, 4)
      : title.year;

  const trailer =
    details?.videos?.results?.find(
      (video: any) =>
        video.site === "YouTube" &&
        video.type === "Trailer" &&
        video.official !== false
    ) ||
    details?.videos?.results?.find(
      (video: any) =>
        video.site === "YouTube" &&
        video.type === "Trailer"
    );

  const cast =
    Array.isArray(
      details?.credits?.cast
    )
      ? details.credits.cast
          .filter(
            (person: any) =>
              person.profile_path
          )
          .slice(0, 12)
      : [];

  const creators =
    Array.isArray(
      details?.created_by
    )
      ? details.created_by
      : [];

  const directors =
    Array.isArray(
      details?.credits?.crew
    )
      ? details.credits.crew.filter(
          (person: any) =>
            person.job === "Director"
        )
      : [];

  const productionCompanies =
    Array.isArray(
      details?.production_companies
    )
      ? details.production_companies
      : [];

  const watchProviders =
    details?.["watch/providers"]?.results?.CA;

  const recommendations =
    Array.isArray(
      details?.recommendations?.results
    )
      ? details.recommendations.results
          .filter(
            (item: any) =>
              item.poster_path
          )
          .slice(0, 12)
      : [];

  const lastEpisode =
    details?.last_episode_to_air;

  const detailsBackdrop =
    details?.backdrop_path
    ? "https://image.tmdb.org/t/p/original" +
        details.backdrop_path
      : title.backdrop || "";

  return (
    <div className="details-page">

      <button
        type="button"
        className="details-back-button"
        onClick={onClose}
      >
        ← Back
      </button>

      {details && (

        <div className="details-shell">

          <div
            className="details-backdrop"
            style={{
              backgroundImage:
                detailsBackdrop
                  ? "linear-gradient(90deg, rgba(17,17,19,.98) 0%, rgba(17,17,19,.78) 40%, rgba(17,17,19,.35) 75%, rgba(17,17,19,.12) 100%), linear-gradient(0deg, #111113 0%, transparent 55%), url(" +
                    detailsBackdrop +
                    ")"
                  : "linear-gradient(0deg, #111113 0%, #202023 100%)"
            }}
          />

          <div className="details-content">

            <div className="details-poster">
              <img
                src={
                  details.poster_path
                    ? "https://image.tmdb.org/t/p/w500" +
                      details.poster_path
                    : title.poster
                }
                alt={displayTitle}
              />
            </div>

            <div className="details-info">

              <div className="eyebrow">
                {title.kind === "movie"
                  ? "MOVIE"
                  : "TV SHOW"}
              </div>

              <h1>
                {displayTitle}
              </h1>

              {details.tagline && (
                <p className="details-tagline">
                  {details.tagline}
                </p>
              )}

              <div className="details-meta">
                <span>
                  {year}
                </span>

                {details.vote_average && (
                  <span>
                    ★{" "}
                    {Number(
                      details.vote_average
                    ).toFixed(1)}
                    /10
                  </span>
                )}

                {details.vote_count && (
                  <span>
                    {Number(
                      details.vote_count
                    ).toLocaleString()}{" "}
                    ratings
                  </span>
                )}

                {details.status && (
                  <span>
                    {details.status}
                  </span>
                )}
              </div>

              {details.genres &&
                Array.isArray(
                  details.genres
                ) &&
                details.genres.length > 0 && (
                  <p className="details-genres">
                    {details.genres
                      .map(
                        (genre: {
                          id: number;
                          name: string;
                        }) =>
                          genre.name
                      )
                      .join(" · ")}
                  </p>
                )}

              <p className="details-overview">
                {details.overview ||
                  title.overview ||
                  "No overview available."}
              </p>

              <div className="details-facts">

                {title.kind === "movie" &&
                  details.runtime && (
                    <div>
                      <strong>
                        Runtime
                      </strong>
                      <span>
                        {details.runtime} minutes
                      </span>
                    </div>
                  )}

                {title.kind === "tv" &&
                  details.number_of_seasons && (
                    <div>
                      <strong>
                        Seasons
                      </strong>
                      <span>
                        {details.number_of_seasons}
                      </span>
                    </div>
                  )}

                {title.kind === "tv" &&
                  details.number_of_episodes && (
                    <div>
                      <strong>
                        Episodes
                      </strong>
                      <span>
                        {details.number_of_episodes}
                      </span>
                    </div>
                  )}

                {details.original_language && (
                  <div>
                    <strong>
                      Language
                    </strong>
                    <span>
                      {details.original_language.toUpperCase()}
                    </span>
                  </div>
                )}

              </div>

              {(creators.length > 0 ||
                directors.length > 0) && (
                <div className="details-credits">

                  {creators.length > 0 && (
                    <div>
                      <strong>
                        Created by
                      </strong>

                      <span>
                        {creators
                          .map(
                            (person: any) =>
                              person.name
                          )
                          .join(", ")}
                      </span>
                    </div>
                  )}

                  {directors.length > 0 && (
                    <div>
                      <strong>
                        Director
                      </strong>

                      <span>
                        {directors
                          .map(
                            (person: any) =>
                              person.name
                          )
                          .join(", ")}
                      </span>
                    </div>
                  )}

                </div>
              )}

              {title.kind === "tv" &&
                lastEpisode && (
                  <div className="details-last-episode">

                    <h3>
                      Last Episode
                    </h3>

                    <div className="details-last-episode-content">

                      {lastEpisode.still_path && (
                        <img
                          src={
                            "https://image.tmdb.org/t/p/w300" +
                            lastEpisode.still_path
                          }
                          alt={
                            lastEpisode.name ||
                            "Last episode"
                          }
                        />
                      )}

                      <div>
                        <strong>
                          {lastEpisode.name}
                        </strong>

                        {lastEpisode.season_number != null &&
                          lastEpisode.episode_number != null && (
                            <span>
                              Season{" "}
                              {
                                lastEpisode.season_number
                              }
                              {" · "}
                              Episode{" "}
                              {
                                lastEpisode.episode_number
                              }
                            </span>
                          )}

                        {lastEpisode.air_date && (
                          <span>
                            {lastEpisode.air_date}
                          </span>
                        )}

                        {lastEpisode.overview && (
                          <p>
                            {
                              lastEpisode.overview
                            }
                          </p>
                        )}
                      </div>

                    </div>

                  </div>
                )}

            </div>

          </div>

          {cast.length > 0 && (
            <section className="details-section">

              <h2>
                Cast
              </h2>

              <div className="details-cast-grid">

                {cast.map(
                  (person: any) => (
                    <div
                      className="details-cast-card"
                      key={
                        person.credit_id ||
                        person.id
                      }
                    >

                      <img
                        src={
                          person.profile_path
                            ? "https://image.tmdb.org/t/p/w185" +
                              person.profile_path
                            : "https://placehold.co/185x278/202023/ffffff?text=No+Photo"
                        }
                        alt={
                          person.name
                        }
                      />

                      <div>
                        <strong>
                          {person.name}
                        </strong>

                        {person.character && (
                          <span>
                            {person.character}
                          </span>
                        )}
                      </div>

                    </div>
                  )
                )}

              </div>

            </section>
          )}

          {trailer && (
            <section className="details-section">

              <h2>
                Trailer
              </h2>

              <div className="details-video">
                <iframe
                  src={
                    "https://www.youtube.com/embed/" +
                    trailer.key
                  }
                  title={
                    trailer.name ||
                    displayTitle +
                      " trailer"
                  }
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

            </section>
          )}

          {title.kind === "tv" &&
            Array.isArray(
              details.seasons
            ) &&
            details.seasons.length > 0 && (
              <section className="details-section">

                <h2>
                  Seasons
                </h2>

                <div className="details-seasons">

                  {details.seasons
                    .filter(
                      (season: any) =>
                        season.season_number >=
                        0
                    )
                    .map(
                      (season: any) => (
                        <div
                          className="details-season-card"
                          key={
                            season.id
                          }
                        >

                          <img
                            src={
                              season.poster_path
                                ? "https://image.tmdb.org/t/p/w342" +
                                  season.poster_path
                                : "https://placehold.co/342x513/202023/ffffff?text=No+Poster"
                            }
                            alt={
                              season.name
                            }
                          />

                          <div>
                            <strong>
                              {season.name}
                            </strong>

                            <span>
                              {season.episode_count}{" "}
                              {season.episode_count ===
                              1
                                ? "episode"
                                : "episodes"}
                            </span>

                            {season.air_date && (
                              <span>
                                {season.air_date.slice(
                                  0,
                                  4
                                )}
                              </span>
                            )}

                          </div>

                        </div>
                      )
                    )}

                </div>

              </section>
            )}

          {productionCompanies.length > 0 && (
            <section className="details-section">

              <h2>
                Production
              </h2>

              <div className="details-production">

                {productionCompanies.map(
                  (company: any) => (
                    <div
                      className="details-production-card"
                      key={
                        company.id
                      }
                    >

                      {company.logo_path && (
                        <img
                          src={
                            "https://image.tmdb.org/t/p/w300" +
                            company.logo_path
                          }
                          alt={
                            company.name
                          }
                        />
                      )}

                      <span>
                        {company.name}
                      </span>

                    </div>
                  )
                )}

              </div>

            </section>
          )}

          {watchProviders && (
            <section className="details-section">

              <h2>
                Where to Watch
              </h2>

              <div className="details-providers">

                {watchProviders.flatrate &&
                  watchProviders.flatrate.map(
                    (provider: any) => (
                      <div
                        className="details-provider"
                        key={
                          provider.provider_id
                        }
                      >

                        {provider.logo_path && (
                          <img
                            src={
                              "https://image.tmdb.org/t/p/w92" +
                              provider.logo_path
                            }
                            alt={
                              provider.provider_name
                            }
                          />
                        )}

                        <span>
                          {provider.provider_name}
                        </span>

                      </div>
                    )
                  )}

                {watchProviders.rent &&
                  watchProviders.rent.map(
                    (provider: any) => (
                      <div
                        className="details-provider"
                        key={
                          "rent-" +
                          provider.provider_id
                        }
                      >

                        {provider.logo_path && (
                          <img
                            src={
                              "https://image.tmdb.org/t/p/w92" +
                              provider.logo_path
                            }
                            alt={
                              provider.provider_name
                            }
                          />
                        )}

                        <span>
                          Rent:{" "}
                          {provider.provider_name}
                        </span>

                      </div>
                    )
                  )}

                {watchProviders.buy &&
                  watchProviders.buy.map(
                    (provider: any) => (
                      <div
                        className="details-provider"
                        key={
                          "buy-" +
                          provider.provider_id
                        }
                      >

                        {provider.logo_path && (
                          <img
                            src={
                              "https://image.tmdb.org/t/p/w92" +
                              provider.logo_path
                            }
                            alt={
                              provider.provider_name
                            }
                          />
                        )}

                        <span>
                          Buy:{" "}
                          {provider.provider_name}
                        </span>

                      </div>
                    )
                  )}

              </div>

            </section>
          )}

          {recommendations.length > 0 && (
            <section className="details-section">

              <h2>
                You May Also Like
              </h2>

              <div className="details-recommendations">

                {recommendations.map(
                  (item: any) => (
                    <button
                      type="button"
                      className="details-recommendation"
                      key={
                        item.id
                      }
                      onClick={() =>
                        onDetails({
                          id:
                            "tmdb-" +
                            (title.kind ===
                            "movie"
                              ? "movie-"
                              : "tv-") +
                            item.id,
                          name:
                            item.title ||
                            item.name,
                          kind:
                            title.kind,
                          year:
                            (
                              item.release_date ||
                              item.first_air_date ||
                              ""
                            ).slice(0, 4),
                          poster:
                            item.poster_path
                              ? "https://image.tmdb.org/t/p/w500" +
                                item.poster_path
                              : "",
                          overview:
                            item.overview ||
                            ""
                        })
                      }
                    >

                      <img
                        src={
                          "https://image.tmdb.org/t/p/w342" +
                          item.poster_path
                        }
                        alt={
                          item.title ||
                          item.name
                        }
                      />

                      <div>
                        <strong>
                          {item.title ||
                            item.name}
                        </strong>

                        {item.vote_average && (
                          <span>
                            ★{" "}
                            {Number(
                              item.vote_average
                            ).toFixed(1)}
                          </span>
                        )}
                      </div>

                    </button>
                  )
                )}

              </div>

            </section>
          )}

        </div>
      )}

    </div>
  );
}

/* =========================================================
PROFILE EDITOR
========================================================= */

function ProfileEditor({
profile,
onClose,
onSave,
onDelete,
adminOverride = false,
onChangePassword
}: {
profile: Profile | null;
onClose: () => void;
onSave: (
name: string,
avatar: string
) => void;
onDelete?: () => void;
adminOverride?: boolean;
onChangePassword?: (
password: string
) => Promise<void>;
}) {
const [name, setName] =
useState(
profile?.name || ""
);

const [avatar, setAvatar] =
useState(
profile?.avatar || "🙂"
);

const [
showPasswordSection,
setShowPasswordSection
] = useState(false);

const [
currentPassword,
setCurrentPassword
] = useState("");

const [
newPassword,
setNewPassword
] = useState("");

const [
showCurrentPassword,
setShowCurrentPassword
] = useState(false);

const [
showNewPassword,
setShowNewPassword
] = useState(false);

const [
passwordError,
setPasswordError
] = useState("");

const avatars = [
"🙂",
"🌸",
"🎬",
"🍿",
"⭐",
"🐱",
"🦋",
"🔥"
];

async function handlePasswordChange() {
  if (!profile) {
    return;
  }

  if (!newPassword.trim()) {
    setPasswordError(
      "Please enter a new password."
    );

    return;
  }

  try {
    await onChangePassword?.(
      newPassword
    );

    setCurrentPassword("");
    setNewPassword("");
    setPasswordError("");
    setShowPasswordSection(
      false
    );
    setShowCurrentPassword(
      false
    );
    setShowNewPassword(
      false
    );

    alert(
      adminOverride
        ? "Password reset successfully."
        : "Password updated successfully."
    );
  } catch (error) {
    setPasswordError(
      error instanceof Error
        ? error.message
        : "Unable to update password."
    );
  }
}

  
return (
<Modal
title={
profile
? "Profile Settings"
: "Add Profile"
}
onClose={onClose}
>


  <label>
    Profile Name

    <input
      autoFocus
      value={name}
      onChange={event =>
        setName(
          event.target.value
        )
      }
    />
  </label>

  <label>
    Profile Icon

    <div className="emoji-grid">

      {avatars.map(
        item => (
          <button
            type="button"
            className={
              avatar === item
                ? "picked"
                : ""
            }
            onClick={() =>
              setAvatar(item)
            }
            key={item}
          >
            {item}
          </button>
        )
      )}

    </div>
  </label>

  <button
    className="pink full"
    onClick={() =>
      onSave(
        name,
        avatar
      )
    }
  >
    Save Profile
  </button>

  {profile && (
    <>
      <button
        className="ghost full"
        onClick={() => {
          setShowPasswordSection(
            current =>
              !current
          );

          setPasswordError(
            ""
          );
          setCurrentPassword(
            ""
          );
          setNewPassword(
            ""
          );
          setShowCurrentPassword(
            false
          );
          setShowNewPassword(
            false
          );
        }}
      >
        {showPasswordSection
          ? "Cancel Password Change"
          : "Change Password"}
      </button>

      {showPasswordSection && (
        <div className="password-settings">

          {!adminOverride && (
            <label>
              Current Password

              <div className="password-wrapper">

                <input
                  type={
                    showCurrentPassword
                      ? "text"
                      : "password"
                  }
                  value={
                    currentPassword
                  }
                  onChange={event => {
                    setCurrentPassword(
                      event.target
                        .value
                    );

                    setPasswordError(
                      ""
                    );
                  }}
                  placeholder="Enter current password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowCurrentPassword(
                      current =>
                        !current
                    )
                  }
                  aria-label={
                    showCurrentPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showCurrentPassword ? (
                    <EyeOff
                      size={18}
                    />
                  ) : (
                    <Eye
                      size={18}
                    />
                  )}
                </button>

              </div>
            </label>
          )}

          {adminOverride && (
            <p className="muted">
              Admin can reset this profile's password without entering the current password.
            </p>
          )}

          <label>
            New Password

            <div className="password-wrapper">

              <input
                type={
                  showNewPassword
                    ? "text"
                    : "password"
                }
                value={
                  newPassword
                }
                onChange={event => {
                  setNewPassword(
                    event.target
                      .value
                  );

                  setPasswordError(
                    ""
                  );
                }}
                placeholder="Enter new password"
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowNewPassword(
                    current =>
                      !current
                  )
                }
                aria-label={
                  showNewPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showNewPassword ? (
                  <EyeOff
                    size={18}
                  />
                ) : (
                  <Eye
                    size={18}
                  />
                )}
              </button>

            </div>
          </label>

          {passwordError && (
            <p className="login-error">
              {
                passwordError
              }
            </p>
          )}

          <button
            className="pink full"
            onClick={
              handlePasswordChange
            }
          >
            {adminOverride
              ? "Reset Password"
              : "Update Password"}
          </button>

        </div>
      )}
    </>
  )}

  {onDelete && (
    <button
      className="danger full"
      onClick={() => {
        if (
          window.confirm(
            "Delete this profile?"
          )
        ) {
          onDelete();
        }
      }}
    >
      Delete Profile
    </button>
  )}

</Modal>


);
}

/* =========================================================
ADD TITLE
========================================================= */

function AddTitle({
library,
onClose,
onAdd
}: {
library: Title[];
onClose: () => void;
onAdd: (title: Title) => Promise<void>;
}) {
const [query, setQuery] =
useState("");

const [results, setResults] =
useState<Title[]>([]);

const [loading, setLoading] =
useState(false);

const [error, setError] =
useState("");

const [addedTitleId, setAddedTitleId] =
useState<string | null>(null);

const [confirmation, setConfirmation] =
useState("");

useEffect(() => {
const cleanQuery =
query.trim();


if (!cleanQuery) {
  setResults([]);
  setError("");
  return;
}

const timer =
  window.setTimeout(
    async () => {
      setLoading(true);
      setError("");

      try {
        const data =
          await searchTMDB(
            cleanQuery
          );

        setResults(data);
      } catch {
        setError(
          "Unable to search TMDB right now."
        );
      } finally {
        setLoading(
          false
        );
      }
    },
    400
  );

return () =>
  window.clearTimeout(
    timer
  );


}, [query]);

useEffect(() => {
if (!confirmation) {
return;
}


const timer =
  window.setTimeout(() => {
    setConfirmation("");
  }, 2500);

return () =>
  window.clearTimeout(
    timer
  );


}, [confirmation]);

async function handleAdd(
  title: Title
) {
  const alreadyAdded =
    library.some(
      item =>
        item.id === title.id
    );

  if (alreadyAdded) {
    setAddedTitleId(
      title.id
    );

    setConfirmation(
      "Already in your library"
    );

    return;
  }

  try {
    await onAdd(title);

    setAddedTitleId(
      title.id
    );

    setConfirmation(
      "Added to your library"
    );
  } catch (error) {
    setConfirmation(
      "Unable to add this title."
    );

    console.error(
      "Failed to add title:",
      error
    );
  }
}

return ( <Modal
   title="Add Movie / TV Show"
   onClose={onClose}
 >


  <div className="search wide">

    <Search size={18} />

    <input
      autoFocus
      value={query}
      onChange={event =>
        setQuery(
          event.target.value
        )
      }
      placeholder="Search Movies and TV Shows"
    />

  </div>

  {confirmation && (
    <div
      className="add-confirmation"
      role="status"
      aria-live="polite"
    >
      <Check size={17} />

      <span>
        {confirmation}
      </span>
    </div>
  )}

  {loading && (
    <p className="muted">
      Searching TMDB...
    </p>
  )}

  {error && (
    <p className="muted">
      {error}
    </p>
  )}

  <div className="result-list">

    {results.map(
      title => {
        const isAdded =
          library.some(
            item =>
              item.id ===
              title.id
          );

        return (
          <div
            className="result"
            key={title.id}
          >

            <img
              src={title.poster}
              alt={title.name}
            />

            <div>

              <b>
                {title.name}
              </b>

              <span>
                {title.year} ·{" "}
                {title.kind ===
                "movie"
                  ? "Movie"
                  : "TV Show"}
              </span>

            </div>

            <button
              className={
                isAdded
                  ? "pink add added"
                  : "pink add"
              }
              disabled={
                isAdded
              }
              onClick={() =>
                handleAdd(
                  title
                )
              }
            >
              {isAdded
                ? "✓ Added"
                : "+ Add"}
            </button>

          </div>
        );
      }
    )}

  </div>

</Modal>


);
}

/* =========================================================
REMINDER
========================================================= */

function addReminderToCalendar(
  title: Title,
  date: string,
  time: string
) {
  const start =
    new Date(
      `${date}T${time}:00`
    );

  const end =
    new Date(
      start.getTime() +
        60 * 60 * 1000
    );

  const formatDate = (
    value: Date
  ) =>
    value
      .toISOString()
      .replace(
        /[-:]/g,
        ""
      )
      .replace(
        /\.\d{3}Z$/,
        "Z"
      );

  const calendarUrl =
    "https://calendar.google.com/calendar/render" +
    "?action=TEMPLATE" +
    "&text=" +
    encodeURIComponent(
      `Watch ${title.name}`
    ) +
    "&dates=" +
    `${formatDate(start)}/${formatDate(end)}` +
    "&details=" +
    encodeURIComponent(
      `Reminder from Streamix to watch ${title.name}.`
    );

  window.open(
    calendarUrl,
    "_blank"
  );
}

function Modal({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
   className={
  title === "Reminders"
    ? "modal reminders-modal"
    : "modal"
}
        onMouseDown={event => {
          event.stopPropagation();
        }}
      >
        <div className="modal-head">
          <h2>{title}</h2>

          <button
            className="icon"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function ReminderModal({
  title,
  onClose,
  onSave
}: {
  title: Title;
  onClose: () => void;
  onSave: (
    date: string,
    time: string,
    method: "push" | "calendar" | "both"
  ) => void;
}) {
  const [date, setDate] =
    useState("");

const [time, setTime] =
  useState(() => {
    const now = new Date();

    return (
      String(
        now.getHours()
      ).padStart(2, "0") +
      ":" +
      String(
        now.getMinutes()
      ).padStart(2, "0")
    );
  });
  const [method, setMethod] =
    useState<
      "push" | "calendar" | "both"
    >("push");

  return (
    <Modal
      title="Remind Me"
      onClose={onClose}
    >
      <p>
        Set a reminder to watch{" "}
        <b>{title.name}</b>.
      </p>

      <label>
        Date

        <input
          type="date"
          value={date}
          onChange={event =>
            setDate(
              event.target.value
            )
          }
        />
      </label>

      <label>
        Time

        <input
          type="time"
          value={time}
          onChange={event =>
            setTime(
              event.target.value
            )
          }
        />
      </label>

      <label>
        How would you like to be
        reminded?

        <select
          value={method}
          onChange={event =>
            setMethod(
              event.target.value as
                | "push"
                | "calendar"
                | "both"
            )
          }
        >
          <option value="push">
            🔔 Streamix notification
          </option>

          <option value="calendar">
            📅 Add to phone calendar
          </option>

          <option value="both">
            🔔📅 Both
          </option>
        </select>
      </label>

      <button
        className="pink full"
        disabled={!date}
        onClick={() =>
          onSave(
            date,
            time,
            method
          )
        }
      >
        Save Reminder
      </button>


    </Modal>
  );
}

/* =========================================================
SCHEDULE RECOMMENDATION
========================================================= */

function ScheduleModal({
title,
profiles,
onClose,
onSave
}: {
title: Title;
profiles: Profile[];
onClose: () => void;
onSave: (
item: Scheduled
) => void;
}) {
const [profileId, setProfileId] =
useState(
profiles[0]?.id || ""
);

const [date, setDate] =
useState("");

const [time, setTime] =
useState("19:00");

const [message, setMessage] =
useState(
"How about this one?"
);

return ( <Modal
   title="Schedule Personal Recommendation"
   onClose={onClose}
 >


  {profiles.length ===
  0 ? (
    <p className="muted">
      Create a profile first.
    </p>
  ) : (
    <>

      <label>
        Profile

        <select
          value={profileId}
          onChange={event =>
            setProfileId(
              event.target
                .value
            )
          }
        >
          {profiles.map(
            profile => (
              <option
                value={
                  profile.id
                }
                key={
                  profile.id
                }
              >
                {
                  profile.name
                }
              </option>
            )
          )}
        </select>
      </label>

      <label>
        Date

        <input
          type="date"
          value={date}
          onChange={event =>
            setDate(
              event.target.value
            )
          }
        />
      </label>

      <label>
        Time

        <input
          type="time"
          value={time}
          onChange={event =>
            setTime(
              event.target.value
            )
          }
        />
      </label>

      <label>
        Message

        <textarea
          value={message}
          onChange={event =>
            setMessage(
              event.target.value
            )
          }
        />

      </label>

      <button
        className="pink full"
        disabled={
          !profileId ||
          !date
        }
        onClick={() =>
          onSave({
            id: uid(),
            profileId,
            titleId:
              title.id,
            date,
            time,
            message
          })
        }
      >
        Schedule
      </button>

    </>
  )}

</Modal>


);
}

/* =========================================================
HERO EDITOR
========================================================= */

function HeroModal({
hero,
library,
settings,
onClose,
onSave
}: {
hero: Title | null;
library: Title[];
settings: HeroSettings;
onClose: () => void;
onSave: (
settings: HeroSettings
) => void;
}) {
const [titleId, setTitleId] =
useState(
settings.titleId ||
library[0]?.id ||
""
);

const [positionX, setPositionX] =
useState(
settings.positionX
);

const [positionY, setPositionY] =
useState(
settings.positionY
);

const selectedTitle =
library.find(
title =>
title.id === titleId
) || hero;

return ( <Modal
   title="Edit Hero"
   onClose={onClose}
 >


  <p>
    Choose which title appears
    in the featured hero.
  </p>

  {library.length ===
  0 ? (
    <p className="muted">
      Add a movie or TV show
      to your library first.
    </p>
  ) : (
    <>

      <label>
        Hero title

        <select
          value={titleId}
          onChange={event =>
            setTitleId(
              event.target
                .value
            )
          }
        >
          {library.map(
            title => (
              <option
                key={title.id}
                value={title.id}
              >
                {title.name}
              </option>
            )
          )}
        </select>
      </label>

      {selectedTitle?.backdrop && (
        <div
          className="hero-preview"
          style={{
            backgroundImage:
              "url(" +
              selectedTitle.backdrop +
              ")",
            backgroundPosition:
              String(
                positionX
              ) +
              "% " +
              String(
                positionY
              ) +
              "%"
          }}
        >
          <div className="hero-preview-overlay">
            Preview
          </div>
        </div>
      )}

    <label>
  Image zoom

  <input
    type="range"
    min="100"
    max="200"
    value={imageZoom}
    onChange={event =>
      setImageZoom(
        Number(
          event.target.value
        )
      )
    }
  />

  <span className="muted">
    {imageZoom}%
  </span>
</label>

      <label>
        Image vertical crop

        <input
          type="range"
          min="0"
          max="100"
          value={positionY}
          onChange={event =>
            setPositionY(
              Number(
                event.target
                  .value
              )
            )
          }
        />

        <span className="muted">
          {positionY}%
        </span>
      </label>

      <button
        className="pink full"
        onClick={() =>
          onSave({
            titleId,
            positionX,
            positionY
          })
        }
      >
        Save Hero
      </button>

    </>
  )}

</Modal>


);
}

/* =========================================================
START APP
========================================================= */

const rootElement =
document.getElementById(
"root"
);

if (!rootElement) {
throw new Error(
"Root element was not found."
);
}

createRoot(
rootElement
).render(
<React.StrictMode> <App />
</React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then(registration => {
        console.log(
          "Streamix service worker registered:",
          registration.scope
        );
      })
      .catch(error => {
        console.error(
          "Streamix service worker registration failed:",
          error
        );
      });
  });
}
