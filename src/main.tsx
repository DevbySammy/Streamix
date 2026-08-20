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
  password?: string;
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

const initialProfiles: Profile[] = [
  {
    id: "admin",
    name: "Admin",
    avatar: "👑",
    password: ""
  }
];

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

function useStored<T>(
  key: string,
  fallback: T
): [
  T,
  React.Dispatch<React.SetStateAction<T>>
] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored =
        localStorage.getItem(key);

      if (!stored) {
        return fallback;
      }

      return JSON.parse(stored) as T;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );
    } catch {
      // Ignore localStorage errors.
    }
  }, [key, value]);

  return [value, setValue];
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

  const url =
    "/api/tmdb/search?query=" +
    encodeURIComponent(cleanQuery) +
    "&type=multi";

  const response = await fetch(url);

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
  const [library, setLibrary] =
    useStored<Title[]>(
      "sx-library",
      []
    );

  const [profiles, setProfiles] =
    useStored<Profile[]>(
      "sx-profiles",
      initialProfiles
    );

  const [states, setStates] =
    useStored<Record<string, State>>(
      "sx-states",
      initialState
    );

  const [reminders, setReminders] =
    useStored<Reminder[]>(
      "sx-reminders",
      []
    );

  const [scheduled, setScheduled] =
    useStored<Scheduled[]>(
      "sx-scheduled",
      []
    );

  const [heroSettings, setHeroSettings] =
    useStored<HeroSettings>(
      "sx-hero-settings",
      initialHero
    );

  /* =======================================================
     AUTHENTICATION / SESSION
  ======================================================= */

  const [profileId, setProfileId] =
    useStored<string | null>(
      "sx-session",
      null
    );

  const [viewingAs, setViewingAs] =
    useStored<string | null>(
      "sx-viewing-as",
      null
    );

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
    useState<SortOption>("name-asc");

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
        targetId ===
          draggedProfileId ||
        targetId === "admin"
      ) {
        setDragOverProfileId(null);
        return;
      }

      const rect =
        row.getBoundingClientRect();

      const middle =
        rect.top + rect.height / 2;

      const position =
        event.clientY < middle
          ? "before"
          : "after";

      setDragOverProfileId(
        targetId
      );

      setDragPosition(position);
    }

    function handlePointerUp(
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

    function handlePointerCancel(
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
      handlePointerUp
    );

    window.addEventListener(
      "pointercancel",
      handlePointerCancel
    );

    return () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      window.removeEventListener(
        "pointerup",
        handlePointerUp
      );

      window.removeEventListener(
        "pointercancel",
        handlePointerCancel
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

    const key =
      "sx-reco-seen-" +
      profileId;

    const alreadySeen =
      localStorage.getItem(key);

    if (!alreadySeen) {
      setShowReco(true);
    }
  }, [
    profileId,
    recommendation
  ]);

  /* =======================================================
     FILTERING + SORTING
  ======================================================= */

  const visible = useMemo(() => {
    const filtered =
      library
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
    q,
    kind,
    tab,
    filter,
    sort,
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

  function closeRecommendation() {
    if (!profileId) {
      return;
    }

    localStorage.setItem(
      "sx-reco-seen-" +
        profileId,
      "true"
    );

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

  function toggle(
    array: keyof State,
    id: string
  ) {
    updateState(current => {
      const exists =
        current[array].includes(id);

      return {
        ...current,
        [array]: exists
          ? current[array].filter(
              item =>
                item !== id
            )
          : [
              ...current[array],
              id
            ]
      };
    });
  }

  /* =======================================================
     REMOVE TITLE
  ======================================================= */

  function removeTitle(
    id: string
  ) {
    setLibrary(
      currentLibrary =>
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
          item.titleId !== id
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

  /* =======================================================
     PROFILE MANAGEMENT
  ======================================================= */

  function addProfile(
    name: string,
    avatar: string
  ) {
    const newProfile: Profile = {
      id: uid(),
      name:
        name.trim() ||
        "New Profile",
      avatar:
        avatar || "🙂"
    };

    setProfiles(current => [
      ...current,
      newProfile
    ]);

    setStates(current => ({
      ...current,
      [newProfile.id]: {
        watched: [],
        watchlist: [],
        rewatch: []
      }
    }));

    setEditing(null);
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
      profileIdToDrag ===
        "admin"
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setDraggedProfileId(
      profileIdToDrag
    );

    setDragOverProfileId(null);
    setDragPointerId(
      event.pointerId
    );
  }

  /* =======================================================
     LOGIN SCREEN
  ======================================================= */

  if (profileId === null) {
    return (
      <div className="app">
        <main>
          <div
            style={{
              minHeight:
                "calc(100vh - 100px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding:
                "40px 20px"
            }}
          >
            <div
              style={{
                width:
                  "min(560px, 100%)"
              }}
            >
              <div
                style={{
                  textAlign:
                    "center",
                  marginBottom:
                    "28px"
                }}
              >
                <img
                  src="/streamix-logo.png"
                  alt="Streamix"
                  style={{
                    display: "block",
                    width: "220px",
                    height: "auto",
                    margin:
                      "0 auto 28px"
                  }}
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
                {orderedProfiles.map(
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

              <p
                className="muted"
                style={{
                  textAlign:
                    "center",
                  marginTop:
                    "24px",
                  fontSize:
                    "13px"
                }}
              >
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

  return (
    <div className="app">

      {/* HEADER */}

      <header>
        <div className="logo">
          <img
            src="/streamix-logo.png"
            alt="Streamix"
            style={{
              display: "block",
              width: "150px",
              height: "auto"
            }}
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

          {/* PRIMARY LOGOUT LOCATION */}

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
                      filter ===
                        "all" &&
                      filterClicked
                        ? "selected"
                        : ""
                    }
                    onClick={() => {
                      setFilter(
                        "all"
                      );
                      setFilterClicked(
                        true
                      );
                    }}
                  >
                    All
                  </button>

                  <button
                    className={
                      filter ===
                      "watchlist"
                        ? "selected"
                        : ""
                    }
                    onClick={() => {
                      setFilter(
                        "watchlist"
                      );
                      setFilterClicked(
                        true
                      );
                    }}
                  >
                    Watchlist
                  </button>

                  <button
                    className={
                      filter ===
                      "watched"
                        ? "selected"
                        : ""
                    }
                    onClick={() => {
                      setFilter(
                        "watched"
                      );
                      setFilterClicked(
                        true
                      );
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
                      event.target
                        .value
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
                  removeTitle(
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

      {/* =====================================================
          PROFILES
      ===================================================== */}

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

                const dropIndicator =
                  isDropTarget
                    ? dragPosition ===
                      "before"
                      ? {
                          borderTop:
                            "3px solid #ff4f9a",
                          paddingTop:
                            "5px"
                        }
                      : {
                          borderBottom:
                            "3px solid #ff4f9a",
                          paddingBottom:
                            "5px"
                        }
                    : {};

                return (
                  <div
                    className={
                      "profile-row" +
                      (isDragging
                        ? " dragging"
                        : "")
                    }
                    key={item.id}
                    data-profile-id={
                      item.id
                    }
                    style={{
                      ...dropIndicator,
                      position:
                        "relative",
                      opacity:
                        isDragging
                          ? 0.45
                          : 1,
                      transition:
                        "opacity .15s ease, border .1s ease"
                    }}
                  >

                    {/* PROFILE SELECT */}

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

                    {/* PROFILE SETTINGS */}

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

                    {/* TOUCH-FRIENDLY DRAG HANDLE */}

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
                          style={{
                            touchAction:
                              "none",
                            cursor:
                              "grab",
                            userSelect:
                              "none",
                            WebkitUserSelect:
                              "none"
                          }}
                        >
                          <GripVertical
                            size={20}
                          />
                        </div>
                      )}

                    {/* DROP LABEL */}

                    {isDropTarget && (
                      <div
                        style={{
                          position:
                            "absolute",
                          right:
                            "12px",
                          top:
                            dragPosition ===
                            "before"
                              ? "-12px"
                              : "auto",
                          bottom:
                            dragPosition ===
                            "after"
                              ? "-12px"
                              : "auto",
                          fontSize:
                            "11px",
                          fontWeight:
                            600,
                          color:
                            "#ff4f9a",
                          background:
                            "#171717",
                          padding:
                            "2px 7px",
                          borderRadius:
                            "999px",
                          pointerEvents:
                            "none",
                          zIndex: 5
                        }}
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

            {/* ADD PROFILE */}

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
          onChangePassword={
            password => {
              if (
                editing.id ===
                "new"
              ) {
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
                            password
                          }
                        : item
                  )
              );
            }
          }
          onDelete={
            editing.id ===
            "new"
              ? undefined
              : () => {
                  const deletedProfileId =
                    editing.id;

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
          onAdd={title =>
            setLibrary(
              current => [
                ...current,
                title
              ]
            )
          }
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
            onSave={settings => {
              setHeroSettings(
                settings
              );

              setShowHero(
                false
              );
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

  const hasPassword =
    Boolean(
      profile.password
    );

  function handleLogin() {
    if (
      profile.password &&
      password ===
        profile.password
    ) {
      onSuccess();
      return;
    }

    setError(
      "Incorrect password. Please try again."
    );
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
        !hasPassword
          ? "Set Your Password"
          : resetting
          ? "Create a New Password"
          : "Profile Login"
      }
      onClose={onClose}
    >

      <div className="profile-login">

        <div className="profile-login-avatar">
          {
            profile.avatar
          }
        </div>

        <h3>
          {profile.name}'s
          Profile
        </h3>

        {!hasPassword ? (
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

            <button
              className="forgot-password"
              onClick={() => {
                setResetting(
                  true
                );

                setPassword("");
                setError("");
                setShowPassword(
                  false
                );
              }}
            >
              Forgot password?
            </button>
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

  return (
    <article className="card">

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
            className="remove"
            onClick={
              onRemove
            }
            title="Remove title"
            aria-label={
              "Remove " +
              t.name
            }
          >
            <Trash2
              size={16}
            />
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
        className="modal"
        style={
          compact
            ? {
                width:
                  "min(560px, calc(100vw - 32px))",
                maxWidth:
                  "560px"
              }
            : undefined
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
  ) => void;
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

  function handlePasswordChange() {
    if (!profile) {
      return;
    }

    if (!profile.password) {
      setPasswordError(
        "This profile does not have a password yet."
      );

      return;
    }

    if (
      !adminOverride &&
      currentPassword !==
        profile.password
    ) {
      setPasswordError(
        "Current password is incorrect."
      );

      return;
    }

    if (!newPassword.trim()) {
      setPasswordError(
        "Please enter a new password."
      );

      return;
    }

    onChangePassword?.(
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
      "Password updated successfully."
    );
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
  onAdd: (title: Title) => void;
}) {
  const [query, setQuery] =
    useState("");

  const [results, setResults] =
    useState<Title[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
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

  const available =
    results.filter(
      title =>
        !library.some(
          item =>
            item.id ===
            title.id
        )
    );

  return (
    <Modal
      title="Add Movie / TV Show"
      onClose={onClose}
    >

      <p className="muted">
        Search TMDB for movies
        and TV shows.
      </p>

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
          placeholder="Search movies and TV shows"
        />

      </div>

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

        {available.map(
          title => (
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
                className="pink add"
                onClick={() => {
                  onAdd(title);

                  setResults(
                    current =>
                      current.filter(
                        item =>
                          item.id !==
                          title.id
                      )
                  );
                }}
              >
                + Add
              </button>

            </div>
          )
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

  return (
    <Modal
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

  return (
    <Modal
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

  return (
    <Modal
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
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
