import React, {
useEffect,
useMemo,
useState
} from "react";
import { createRoot } from "react-dom/client";
import {
Check,
ChevronDown,
GripVertical,
Clock,
Eye,
EyeOff,
Film,
Plus, 
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
poster: string;
backdrop: string;
overview: string;
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
| "just-added"
| "name-asc"
| "name-desc"
| "year-desc"
| "year-asc";

type HeroSettings = {
titleId: string | null;
positionX: number;
positionY: number;
};

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

/* =========================================================
APP
========================================================= */

function App() {
  const [library, setLibrary] = useState<Title[]>([]);

  const [
    justAdded,
    setJustAdded
  ] = useState<Title[]>([]);

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

{/* this one piece of code below shows 30 - 30 movies listed before you press show more */}
   const [
  justAddedLimit,
  setJustAddedLimit
] = useState(30);
   
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
              hiddenTitles
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
        setProfileId(
          data.profile.id
        );
      } else {
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

const [tab, setTab] =
  useState<"library" | "rewatch">(
    "library"
  );

const [filter, setFilter] =
useState<
"all" | "watchlist" | "watched"
>("all");

const [filterClicked, setFilterClicked] =
useState(false);

const [kind, setKind] =
useState<"all" | Kind>("all");

const [kindClicked, setKindClicked] =
useState(false);


const [sort, setSort] =
  useState<SortOption>(() => {
    const savedSort =
      localStorage.getItem(
        "sx-sort"
      );

    return (
      (savedSort as SortOption) ||
      "name-asc"
    );
  });
   useEffect(() => {
  localStorage.setItem(
    "sx-sort",
    sort
  );
}, [sort]);
   
useEffect(() => {
  if (sort !== "just-added") {
    return;
  }

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

      setJustAdded(
        titles
      );
    } catch (error) {
      console.error(
        "Failed to load Just Added:",
        error
      );

      setJustAdded([]);
    }
  }

  loadJustAdded();
}, [sort]);

const [q, setQ] = useState("");

const [showProfile, setShowProfile] =
useState(false);

const [loginProfile, setLoginProfile] =
useState<Profile | null>(null);

const [showAdd, setShowAdd] =
useState(false);

const [showReco, setShowReco] =
useState(false);

const [showReminder, setShowReminder] =
useState<Title | null>(null);

const [showSchedule, setShowSchedule] =
useState<Title | null>(null);

const [showHero, setShowHero] =
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


const regularProfiles =
  profiles.filter(
    profile =>
      profile.id !== "admin"
  );

return adminProfile
  ? [
      adminProfile,
      ...regularProfiles
    ]
  : regularProfiles;


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
profileId !== null &&
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
setProfileId,
setViewingAs
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

/* =======================================================
FILTERING + SORTING
======================================================= */

const visible = useMemo(() => {
  const source =
    sort === "just-added"
      ? (
          isAdmin &&
          justAddedView === "hidden"
            ? hiddenJustAdded
            : justAdded
        )
      : library;

const filtered =
source
 
.filter(title =>
title.name
.toLowerCase()
.includes(
q.toLowerCase()
)
)
.filter(title => {
if (kind === "all") {
return true;
}


      return (
        title.kind === kind
      );
    })
  .filter(title => {
  if (sort === "just-added") {
    return true;
  }

  if (tab === "rewatch") {
    return state.rewatch.includes(
      title.id
    );
  }

  if (filter === "all") {
    return true;
  }

  if (
    filter === "watched"
  ) {
    return state.watched.includes(
      title.id
    );
  }

  return state.watchlist.includes(
    title.id
  );
});

if (
  sort === "just-added"
) {
  return filtered.slice(
    0,
    justAddedLimit
  );
}
 
return [...filtered].sort(
  (a, b) => {
    switch (sort) {
      case "name-desc":
        return b.name.localeCompare(
          a.name
        );

      case "year-desc":
        return (
          b.year - a.year
        );

      case "year-asc":
        return (
          a.year - b.year
        );

      case "name-asc":
      default:
        return a.name.localeCompare(
          b.name
        );
    }
  }
);


}, [
  library,
  justAdded,
  hiddenJustAdded,
  q,
  kind,
  tab,
  filter,
  sort,
  justAddedView,
  justAddedLimit,
  state
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
  id: string
) {
  if (!effectiveProfileId) {
    return;
  }

  const currentState =
    states[effectiveProfileId] || {
      watched: [],
      watchlist: [],
      rewatch: []
    };

  const exists =
    currentState[array].includes(id);

  const endpoint =
    array === "watched"
      ? "/api/watch-history"
      : array === "watchlist"
        ? "/api/watchlist"
        : "/api/rewatch";

  try {
    const response = await fetch(
      exists
        ? `${endpoint}?profileId=${encodeURIComponent(
            effectiveProfileId
          )}&libraryItemId=${encodeURIComponent(id)}`
        : endpoint,
      {
        method: exists ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        ...(exists
          ? {}
          : {
              body: JSON.stringify({
                profileId:
                  effectiveProfileId,
                libraryItemId: id
              })
            })
      }
    );

    if (!response.ok) {
      throw new Error(
        "Failed to update media state"
      );
    }

    updateState(current => {
      return {
        ...current,
        [array]: exists
          ? current[array].filter(
              item => item !== id
            )
          : [
              ...current[array],
              id
            ]
      };
    });
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
          const alreadyExists =
            current.some(
              item =>
                item.id === id
            );

          if (alreadyExists) {
            return current;
          }

          return [
            ...current,
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
                  item.id !==
                  "testing"
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
        <button
          className="admin-badge"
          onClick={() => {
        setViewingAs(null);

localStorage.removeItem(
  "sx-viewing-as"
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
          ← ADMIN
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

          </div>
        )}

    </div>
  </header>

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

      <div className="eyebrow">
        {isViewingAs
          ? "VIEWING AS " +
            (
              profile?.name ||
              ""
            ).toUpperCase()
          : "FEATURED"}
      </div>

      {hero ? (
        <>
          <h1>
            {hero.name}
          </h1>

          <p>
            {hero.year} ·{" "}
            {hero.kind ===
            "movie"
              ? "Movie"
              : "TV Show"}
          </p>

          {isAdmin && (
            <button
              className="ghost"
              onClick={() =>
                setShowHero(
                  true
                )
              }
            >
              Edit Hero
            </button>
          )}
        </>
      ) : (
        <>
          <h1>
            Your library is
            empty
          </h1>

          {isAdmin && (
            <button
              className="ghost"
              onClick={() =>
                setShowAdd(
                  true
                )
              }
            >
              Add your first
              title
            </button>
          )}
        </>
      )}

    </div>

  </section>

  {/* MAIN */}

  <main>

    {/* PRIMARY NAVIGATION */}

    <div className="switch">

      <button
        className={
          tab === "library"
            ? "active"
            : ""
        }
        onClick={() => {
          setTab("library");
          setFilter("all");
        }}
      >
        Library
      </button>

      {!isAdmin && (
        <button
          className={
            tab === "rewatch"
              ? "active rewatch-tab"
              : "rewatch-tab"
          }
          onClick={() =>
            setTab("rewatch")
          }
        >
          Re-watch
        </button>
      )}

    </div>

  {/* LIBRARY CONTROLS */}

{tab === "library" && (
  <>

    <div className="toolbar">

      {!isAdmin && (
        <div className="filters">

          <button
            className={
              filter === "all" &&
              filterClicked
                ? "selected"
                : ""
            }
            onClick={() => {
              setFilter("all");
              setFilterClicked(true);
            }}
          >
            All
          </button>

          <button
            className={
              filter === "watchlist"
                ? "selected"
                : ""
            }
            onClick={() => {
              setFilter("watchlist");
              setFilterClicked(true);
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
              setFilter("watched");
              setFilterClicked(true);
            }}
          >
            Watched
          </button>

        </div>
      )}

      <div className="search">

        <Search
          size={18}
        />

        <input
          value={q}
          onChange={event =>
            setQ(
              event.target.value
            )
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
              setKindClicked(
                true
              );
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
              setKindClicked(
                true
              );
            }}
          >
            <Film size={15} />
            Movies
          </button>

          <button
            className={
              kind === "tv"
                ? "selected"
                : ""
            }
            onClick={() => {
              setKind("tv");
              setKindClicked(
                true
              );
            }}
          >
            <Tv size={15} />
            TV
          </button>

          {isAdmin &&
  sort === "just-added" && (
    <button
      type="button"
      className={
        justAddedView === "hidden"
          ? "selected"
          : ""
      }
      onClick={() =>
        setJustAddedView(
          current =>
            current === "visible"
              ? "hidden"
              : "visible"
        )
      }
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
                event.target
                  .value as SortOption
              )
            }
            aria-label="Sort library"
          >
          
           <option value="just-added">
    Just Added
  </option>
           
           <option value="name-asc">
              Name A–Z
            </option>

            <option value="name-desc">
              Name Z–A
            </option>

            <option value="year-desc">
              Newest release
            </option>

            <option value="year-asc">
              Oldest release
            </option>

          </select>

        </div>

      </>
    )}

    {/* LIBRARY */}

    <div className="grid">

      {visible.map(
        title => (
          <Card
            key={title.id}
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
                title.id
              )
            }
            onList={() =>
              toggle(
                "watchlist",
                title.id
              )
            }
            onRewatch={() =>
              toggle(
                "rewatch",
                title.id
              )
            }
        onRemove={() =>
  sort === "just-added"
    ? justAddedView === "hidden"
      ? showJustAddedAgain(
          title.id
        )
      : hideJustAddedTitle(
          title.id
        )
    : removeTitle(
        title.id
      )
}
            onReminder={() =>
              setShowReminder(
                title
              )
            }
            onSchedule={() =>
              setShowSchedule(
                title
              )
            }
          />
        )
      )}

      {!visible.length && (
        <div className="empty">
          {library.length ===
          0
            ? "Your library is empty."
            : "Nothing here yet."}
        </div>
      )}

      </div>

    {sort === "just-added" &&
      visible.length < justAdded.length && (
<button
  type="button"
  className="show-more-button"
  onClick={() =>
    setJustAddedLimit(
      current => current + 30
    )
  }
>
          Show more
        </button>
      )}

  </main>

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

      {orderedProfiles
        .filter(
          item =>
            item.id !==
            "testing"
        )
        .map(
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

    localStorage.removeItem(
      "sx-admin-session-token"
    );

    setProfileId("admin");
    setViewingAs(null);
    setShowProfile(false);

    return;
  }
}

if (
  isAdminUser
) {
  if (
    item.id ===
    "admin"
  ) {
    setViewingAs(
      null
    );
    setProfileId(
      "admin"
    );
  } else {
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
                  item.id !==
                    "admin" && (
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

      {isAdmin && (
        <button
          className="add-profile"
          onClick={() => {
            const testingProfile =
              profiles.find(
                item =>
                  item.id ===
                  "testing"
              );

            if (
              testingProfile
            ) {
              setLoginProfile(
                testingProfile
              );

              setShowProfile(
                false
              );
            }
          }}
        >
          <span className="avatar">
            🧪
          </span>
          TESTING
        </button>
      )}

    </div>

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

  const response = await fetch(
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
      onClose={() =>
        setShowReminder(
          null
        )
      }
      onSave={(
        date,
        time
      ) => {
        if (!profileId) {
          return;
        }

        setReminders(
          current => [
            ...current,
            {
              id: uid(),
              profileId,
              titleId:
                showReminder.id,
              date,
              time
            }
          ]
        );

        setShowReminder(
          null
        );
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
            <p className="muted">
              This profile is for Admin
              testing only. It lets you
              experience the app exactly
              as a regular user.
            </p>

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
onSchedule
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
}) {
const isOnWatchlist =
st.watchlist.includes(
t.id
);

const isWatched =
st.watched.includes(
t.id
);

const isRewatch =
st.rewatch.includes(
t.id
);

return ( <article className="card">


  <div className="poster-wrap">

    <img
      src={t.poster}
      alt={t.name}
      onError={event => {
        event.currentTarget.src =
          "https://placehold.co/500x750/171717/ffffff?text=" +
          encodeURIComponent(
            t.name
          );
      }}
    />

    <span className="kind">
      {t.kind === "movie"
        ? "MOVIE"
        : "TV"}
    </span>

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
          t.name +
          " from Just Added"
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
            className={
              isOnWatchlist
                ? "on"
                : ""
            }
            onClick={
              onList
            }
          >
            {isOnWatchlist
              ? "✓ Watchlist"
              : "+ Watchlist"}
          </button>

          <button
            className={
              isWatched
                ? "on"
                : ""
            }
            onClick={
              onWatch
            }
          >
            {isWatched
              ? "✓ Watched"
              : "Mark watched"}
          </button>

        </div>

        <div className="small-actions">

          <button
            className={
              isRewatch
                ? "rewatch-action on"
                : "rewatch-action"
            }
            onClick={
              onRewatch
            }
          >
            ↻ Re-watch
          </button>

          <button
            onClick={
              onReminder
            }
          >
            Remind me
          </button>

        </div>
      </>
    )}

  </div>

</article>


);
}

/* =========================================================
MODAL
========================================================= */

function Modal({
title,
onClose,
children,
compact = false
}: {
title: string;
onClose: () => void;
children: React.ReactNode;
compact?: boolean;
}) {
return (
<div
className="overlay"
onMouseDown={event => {
if (
event.currentTarget ===
event.target
) {
onClose();
}
}}
>


  <div
    className={
      compact
        ? "modal compact"
        : "modal"
    }
  >

    <div className="modal-head">

      <h2>{title}</h2>

      <button
        className="icon"
        onClick={onClose}
        aria-label="Close"
      >
        <X />
      </button>

    </div>

    {children}

  </div>

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

function ReminderModal({
title,
onClose,
onSave
}: {
title: Title;
onClose: () => void;
onSave: (
date: string,
time: string
) => void;
}) {
const [date, setDate] =
useState("");

const [time, setTime] =
useState("19:00");

return ( <Modal
   title="Remind Me"
   onClose={onClose}
 >


  <p>
    Set a reminder for{" "}
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

  <button
    className="pink full"
    disabled={!date}
    onClick={() =>
      onSave(
        date,
        time
      )
    }
  >
    Save Reminder
  </button>

  <p className="muted">
    Notification delivery will
    be connected to the
    Streamix notification
    system.
  </p>

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
        Image horizontal crop

        <input
          type="range"
          min="0"
          max="100"
          value={positionX}
          onChange={event =>
            setPositionX(
              Number(
                event.target
                  .value
              )
            )
          }
        />

        <span className="muted">
          {positionX}%
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
