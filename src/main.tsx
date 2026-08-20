import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Film,
  LogOut,
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
    avatar: "👑"
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
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);

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

function getPosterUrl(path: string | null | undefined): string {
  if (!path) {
    return "https://placehold.co/500x750/171717/ffffff?text=No+Poster";
  }

  return "https://image.tmdb.org/t/p/w500" + path;
}

function getBackdropUrl(
  path: string | null | undefined
): string {
  if (!path) {
    return "";
  }

  return "https://image.tmdb.org/t/p/w1280" + path;
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
          ? Number(releaseDate.slice(0, 4))
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

        addedAt: new Date().toISOString()
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

  const [profileId, setProfileId] =
    useState("admin");

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

  const isAdmin = profileId === "admin";

  const profile =
    profiles.find(
      item => item.id === profileId
    ) || profiles[0];

  const state =
    states[profileId] || {
      watched: [],
      watchlist: [],
      rewatch: []
    };

  const hero = heroSettings.titleId
    ? library.find(
        item =>
          item.id ===
          heroSettings.titleId
      ) || null
    : null;

  /* =======================================================
     RECOMMENDATION
  ======================================================= */

  const recommendation = useMemo(() => {
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

    return watchlistTitles[0] || null;
  }, [library, state]);

  useEffect(() => {
    if (!profileId || !recommendation) {
      return;
    }

    const key =
      "sx-reco-seen-" + profileId;

    const alreadySeen =
      localStorage.getItem(key);

    if (!alreadySeen) {
      setShowReco(true);
    }
  }, [profileId, recommendation]);

  function closeRecommendation() {
    localStorage.setItem(
      "sx-reco-seen-" + profileId,
      "true"
    );

    setShowReco(false);
  }

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

          return title.kind === kind;
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

          if (filter === "watched") {
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
            return b.year - a.year;

          case "year-asc":
            return a.year - b.year;

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
     STATE ACTIONS
  ======================================================= */

  function updateState(
    fn: (current: State) => State
  ) {
    setStates(currentStates => {
      const currentState =
        currentStates[profileId] || {
          watched: [],
          watchlist: [],
          rewatch: []
        };

      return {
        ...currentStates,
        [profileId]:
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
              item => item !== id
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

  function removeTitle(id: string) {
    setLibrary(currentLibrary =>
      currentLibrary.filter(
        title => title.id !== id
      )
    );

    setStates(currentStates => {
      const nextStates = {
        ...currentStates
      };

      Object.keys(nextStates).forEach(
        profileKey => {
          const profileState =
            nextStates[
              profileKey
            ];

          nextStates[profileKey] = {
            watched:
              profileState.watched.filter(
                item => item !== id
              ),

            watchlist:
              profileState.watchlist.filter(
                item => item !== id
              ),

            rewatch:
              profileState.rewatch.filter(
                item => item !== id
              )
          };
        }
      );

      return nextStates;
    });

    setReminders(current =>
      current.filter(
        reminder =>
          reminder.titleId !== id
      )
    );

    setScheduled(current =>
      current.filter(
        item =>
          item.titleId !== id
      )
    );

    setHeroSettings(current => {
      if (current.titleId !== id) {
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

  function moveProfile(
    index: number,
    direction: "up" | "down"
  ) {
    if (
      direction === "up" &&
      index === 0
    ) {
      return;
    }

    if (
      direction === "down" &&
      index === profiles.length - 1
    ) {
      return;
    }

    setProfiles(current => {
      const next = [...current];

      const target =
        direction === "up"
          ? index - 1
          : index + 1;

      const temp =
        next[index];

      next[index] =
        next[target];

      next[target] =
        temp;

      return next;
    });
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="app">

      {/* HEADER */}

      <header>
        <div className="logo">
          STREAM<span>IX</span>
        </div>

        <div className="header-right">

          <button
            className="profile-pill"
            onClick={() =>
              setShowProfile(true)
            }
          >
            <span>
              {profile.avatar}
            </span>

            {profile.name}

            <ChevronDown
              size={16}
            />
          </button>

          {isAdmin && (
            <button
              className="admin-badge"
              onClick={() =>
                setMenu(
                  current => !current
                )
              }
            >
              SETTINGS
            </button>
          )}

          {menu && isAdmin && (
            <div className="admin-menu">

              <button
                onClick={() => {
                  setShowAdd(true);
                  setMenu(false);
                }}
              >
                <Plus />
                Add title
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
            FEATURED
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
                    setShowHero(true)
                  }
                >
                  Edit Hero
                </button>
              )}
            </>
          ) : (
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
                  Add your first title
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
      filter === "all" && filterClicked
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
      kind === "all" && kindClicked
        ? "selected"
        : ""
    }
    onClick={() => {
      setKind("all");
      setKindClicked(true);
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
    }}
  >
    <Film
      size={15}
    />
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
      setKindClicked(true);
    }}
  >
    <Tv
      size={15}
    />
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

          {visible.map(title => (
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
          ))}

          {!visible.length && (
            <div className="empty">
              {library.length === 0
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
                  {recommendation.name}
                </h2>

                <p>
                  {recommendation.year}{" "}
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
          onClose={() =>
            setShowProfile(false)
          }
        >

          <div className="profiles">

            {profiles.map(
              (item, index) => (
                <div
                  className="profile-row"
                  key={item.id}
                >

                  <button
                    onClick={() => {
                      setProfileId(
                        item.id
                      );

                      setShowProfile(
                        false
                      );
                    }}
                    className={
                      item.id ===
                      profileId
                        ? "current"
                        : ""
                    }
                  >

                    <span className="avatar">
                      {item.avatar}
                    </span>

                    <span>
                      {item.name}
                    </span>

                    {item.id ===
                      profileId && (
                      <Check
                        size={18}
                      />
                    )}

                  </button>

                  {isAdmin &&
                    item.id !==
                      "admin" && (
                      <button
                        className="icon"
                        onClick={() => {
                          setEditing(
                            item
                          );

                          setShowProfile(
                            false
                          );
                        }}
                      >
                        ✎
                      </button>
                    )}

                  {isAdmin &&
                    profiles.length >
                      1 && (
                      <div className="profile-order">

                        <button
                          className="icon"
                          disabled={
                            index ===
                            0
                          }
                          onClick={() =>
                            moveProfile(
                              index,
                              "up"
                            )
                          }
                          aria-label="Move profile up"
                        >
                          <ChevronLeft
                            size={16}
                          />
                        </button>

                        <button
                          className="icon"
                          disabled={
                            index ===
                            profiles.length -
                              1
                          }
                          onClick={() =>
                            moveProfile(
                              index,
                              "down"
                            )
                          }
                          aria-label="Move profile down"
                        >
                          <ChevronRight
                            size={16}
                          />
                        </button>

                      </div>
                    )}

                </div>
              )
            )}

            {isAdmin && (
              <button
                className="add-profile"
                onClick={() => {
                  setEditing({
                    id: "new",
                    name: "",
                    avatar: "🙂"
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

      {/* PROFILE EDITOR */}

      {editing && (
        <ProfileEditor
          profile={
            editing.id === "new"
              ? null
              : editing
          }
          onClose={() =>
            setEditing(null)
          }
          onSave={(name, avatar) => {
            if (
              editing.id === "new"
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
          onDelete={
            editing.id === "new"
              ? undefined
              : () => {
                  setProfiles(
                    current =>
                      current.filter(
                        item =>
                          item.id !==
                          editing.id
                      )
                  );

                  setStates(
                    current => {
                      const next = {
                        ...current
                      };

                      delete next[
                        editing.id
                      ];

                      return next;
                    }
                  );

                  setEditing(null);
                  setProfileId("admin");
                }
          }
        />
      )}

      {/* ADD TITLE */}

      {showAdd && (
        <AddTitle
          library={library}
          onClose={() =>
            setShowAdd(false)
          }
          onAdd={title =>
            setLibrary(current => [
              ...current,
              title
            ])
          }
        />
      )}

      {/* REMINDER */}

      {showReminder && (
        <ReminderModal
          title={showReminder}
          onClose={() =>
            setShowReminder(null)
          }
          onSave={(date, time) => {
            setReminders(current => [
              ...current,
              {
                id: uid(),
                profileId,
                titleId:
                  showReminder.id,
                date,
                time
              }
            ]);

            setShowReminder(null);
          }}
        />
      )}

      {/* SCHEDULE */}

      {showSchedule &&
        isAdmin && (
          <ScheduleModal
            title={showSchedule}
            profiles={profiles.filter(
              item =>
                item.id !== "admin"
            )}
            onClose={() =>
              setShowSchedule(null)
            }
            onSave={item => {
              setScheduled(
                current => [
                  ...current,
                  item
                ]
              );

              setShowSchedule(null);
            }}
          />
        )}

      {/* HERO EDITOR */}

      {showHero &&
        isAdmin && (
          <HeroModal
            hero={hero}
            library={library}
            settings={heroSettings}
            onClose={() =>
              setShowHero(false)
            }
            onSave={settings => {
              setHeroSettings(
                settings
              );

              setShowHero(false);
            }}
          />
        )}

      {/* FOOTER */}

      <footer>

        <span>
          <Clock
            size={14}
          />

          {
            reminders.filter(
              reminder =>
                reminder.profileId ===
                profileId
            ).length
          }{" "}
          reminder(s)
        </span>

        {isAdmin && (
          <span>
            {scheduled.length}{" "}
            scheduled reco(s)
          </span>
        )}

        <button
          onClick={() =>
            alert(
              "Sign out will be connected to your real authentication system."
            )
          }
        >
          <LogOut
            size={14}
          />
          Sign out
        </button>

      </footer>

    </div>
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
    st.watchlist.includes(t.id);

  const isWatched =
    st.watched.includes(t.id);

  const isRewatch =
    st.rewatch.includes(t.id);

  return (
    <article className="card">

      <div className="poster-wrap">

        <img
          src={t.poster}
          alt={t.name}
          onError={event => {
            event.currentTarget.src =
              "https://placehold.co/500x750/171717/ffffff?text=" +
              encodeURIComponent(t.name);
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
            onClick={onRemove}
            title="Remove title"
            aria-label={"Remove " + t.name}
          >
            <Trash2 size={16} />
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
                onClick={onList}
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
                onClick={onWatch}
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
                onClick={onRewatch}
              >
                ↻ Re-watch
              </button>

              <button
                onClick={onReminder}
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
        if (
          event.currentTarget ===
          event.target
        ) {
          onClose();
        }
      }}
    >

      <div className="modal">

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
  onDelete
}: {
  profile: Profile | null;
  onClose: () => void;
  onSave: (
    name: string,
    avatar: string
  ) => void;
  onDelete?: () => void;
}) {
  const [name, setName] =
    useState(
      profile?.name || ""
    );

  const [avatar, setAvatar] =
    useState(
      profile?.avatar || "🙂"
    );

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

  return (
    <Modal
      title={
        profile
          ? "Edit Profile"
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
        Profile Photo

        <div className="emoji-grid">

          {avatars.map(item => (
            <button
              className={
                avatar === item
                  ? "picked"
                  : ""
              }
              onClick={() =>
                setAvatar(item)
              }
              key={item}
              type="button"
            >
              {item}
            </button>
          ))}

        </div>
      </label>

      <label>
        Upload Photo

        <input
          type="file"
          accept="image/*"
        />
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
            setLoading(false);
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

        <Search
          size={18}
        />

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

        {available.map(title => (
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
        ))}

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

      {profiles.length === 0 ? (
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
                  event.target.value
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
                    {profile.name}
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

      {library.length === 0 ? (
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
                  event.target.value
                )
              }
            >
              {library.map(title => (
                <option
                  key={title.id}
                  value={title.id}
                >
                  {title.name}
                </option>
              ))}
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
                  String(positionX) +
                  "% " +
                  String(positionY) +
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

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
