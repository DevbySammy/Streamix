import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  Check,
  ChevronDown,
  Clock,
  Film,
  Heart,
  LogOut,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Tv,
  X,
} from "lucide-react";
import "./styles.css";

type Kind = "movie" | "tv";

type Title = {
  id: string;
  name: string;
  kind: Kind;
  year: number;
  poster: string;
  backdrop: string;
  overview: string;
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

/* --------------------------------------------------
   STARTER LIBRARY
-------------------------------------------------- */

const mock: Title[] = [
  {
    id: "matrix",
    name: "The Matrix",
    kind: "movie",
    year: 1999,
    poster:
      "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    backdrop:
      "https://image.tmdb.org/t/p/w1280/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
    overview:
      "A hacker discovers that the world he knows is an elaborate simulation.",
  },
  {
    id: "interstellar",
    name: "Interstellar",
    kind: "movie",
    year: 2014,
    poster:
      "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    backdrop:
      "https://image.tmdb.org/t/p/w1280/xJHokMbljvjADYdit5fK5QTB1lx.jpg",
    overview:
      "Explorers travel through a wormhole in space in an attempt to ensure humanity’s survival.",
  },
  {
    id: "the-bear",
    name: "The Bear",
    kind: "tv",
    year: 2022,
    poster:
      "https://image.tmdb.org/t/p/w500/sHFlbKS3WLqMnpAcZsVv0M9w5sR.jpg",
    backdrop:
      "https://image.tmdb.org/t/p/w1280/7C2j9rA0j3xqVhX0vJvX4q5t6uI.jpg",
    overview:
      "A young chef returns to Chicago to run his family sandwich shop.",
  },
  {
    id: "succession",
    name: "Succession",
    kind: "tv",
    year: 2018,
    poster:
      "https://image.tmdb.org/t/p/w500/7HW47XbkNQ5fiwQFYGqwR5f7k4s.jpg",
    backdrop:
      "https://image.tmdb.org/t/p/w1280/8Y4i1M8i1fV0G0xY7z8gq2vWqKp.jpg",
    overview:
      "A powerful family faces an uncertain future as control of their media empire is contested.",
  },
  {
    id: "spirited-away",
    name: "Spirited Away",
    kind: "movie",
    year: 2001,
    poster:
      "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
    backdrop:
      "https://image.tmdb.org/t/p/w1280/AbC2D3e4F5g6H7i8J9k0L1m2N3o.jpg",
    overview:
      "A young girl enters a mysterious spirit world and must find her way home.",
  },
  {
    id: "severance",
    name: "Severance",
    kind: "tv",
    year: 2022,
    poster:
      "https://image.tmdb.org/t/p/w500/l9x7pZ5mKQ8r5H0q7tYv2W3x4aB.jpg",
    backdrop:
      "https://image.tmdb.org/t/p/w1280/l9x7pZ5mKQ8r5H0q7tYv2W3x4aB.jpg",
    overview:
      "Employees undergo a procedure that separates their work and personal memories.",
  },
];

const initialProfiles: Profile[] = [
  { id: "admin", name: "Admin", avatar: "👑" },
  { id: "sarah", name: "Sarah", avatar: "🌸" },
  { id: "john", name: "John", avatar: "🎬" },
];

const initialState: Record<string, State> = {
  admin: {
    watched: ["matrix"],
    watchlist: ["interstellar", "the-bear"],
    rewatch: ["matrix"],
  },
  sarah: {
    watched: ["the-bear"],
    watchlist: ["matrix", "severance"],
    rewatch: ["the-bear"],
  },
  john: {
    watched: ["succession"],
    watchlist: ["spirited-away", "interstellar"],
    rewatch: [],
  },
};

const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

/* --------------------------------------------------
   TMDB SEARCH
-------------------------------------------------- */

async function searchTMDB(query: string): Promise<Title[]> {
  if (!query.trim()) return [];

  const response = await fetch(
    `/api/tmdb/search?query=${encodeURIComponent(query)}&type=multi`
  );

  if (!response.ok) {
    throw new Error("TMDB search failed");
  }

  const data = await response.json();

  return (data.results || [])
    .filter(
      (item: any) =>
        item.media_type === "movie" || item.media_type === "tv"
    )
    .map((item: any): Title => {
      const kind: Kind = item.media_type === "tv" ? "tv" : "movie";

      const date =
        kind === "movie" ? item.release_date : item.first_air_date;

      return {
        id: `tmdb-${kind}-${item.id}`,
        name: kind === "movie" ? item.title : item.name,
        kind,
        year: date ? Number(date.slice(0, 4)) : 0,

        poster: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : `https://placehold.co/500x750/171717/ffffff?text=No+Poster`,

        backdrop: item.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
          : "",

        overview: item.overview || "",
      };
    });
}

/* --------------------------------------------------
   APP
-------------------------------------------------- */

function App() {
  const [library, setLibrary] = useStored<Title[]>("sx-library", mock);
  const [profiles, setProfiles] = useStored<Profile[]>(
    "sx-profiles",
    initialProfiles
  );
  const [states, setStates] = useStored<Record<string, State>>(
    "sx-states",
    initialState
  );
  const [reminders, setReminders] = useStored<Reminder[]>(
    "sx-reminders",
    []
  );
  const [scheduled, setScheduled] = useStored<Scheduled[]>(
    "sx-scheduled",
    []
  );
  const [hero, setHero] = useStored<Title>("sx-hero", mock[1]);

  const [profileId, setProfileId] = useState("admin");

  const [tab, setTab] = useState<"library" | "rewatch">("library");

  const [filter, setFilter] = useState<
    "all" | "watchlist" | "watched"
  >("all");

  const [kind, setKind] = useState<"all" | Kind>("all");

  const [q, setQ] = useState("");

  const [showProfile, setShowProfile] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showReco, setShowReco] = useState(true);
  const [showReminder, setShowReminder] =
    useState<Title | null>(null);
  const [showSchedule, setShowSchedule] =
    useState<Title | null>(null);
  const [showHero, setShowHero] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [menu, setMenu] = useState(false);

  const isAdmin = profileId === "admin";

  const profile =
    profiles.find((x) => x.id === profileId) || profiles[0];

  const state = states[profileId] || {
    watched: [],
    watchlist: [],
    rewatch: [],
  };

  /* --------------------------------------------------
     FILTER LIBRARY
  -------------------------------------------------- */

  const visible = useMemo(() => {
    return library
      .filter((title) =>
        title.name.toLowerCase().includes(q.toLowerCase())
      )
      .filter(
        (title) => kind === "all" || title.kind === kind
      )
      .filter((title) => {
        if (tab === "rewatch") {
          return state.rewatch.includes(title.id);
        }

        if (filter === "all") return true;

        if (filter === "watched") {
          return state.watched.includes(title.id);
        }

        return state.watchlist.includes(title.id);
      });
  }, [library, q, kind, tab, filter, state]);

  const recommendation =
    library.find(
      (title) =>
        state.watchlist.includes(title.id) &&
        !state.watched.includes(title.id)
    ) ||
    library.find(
      (title) => !state.watched.includes(title.id)
    );

  const updateState = (fn: (s: State) => State) => {
    setStates({
      ...states,
      [profileId]: fn(state),
    });
  };

  const toggle = (arr: keyof State, id: string) => {
    updateState((s) => ({
      ...s,
      [arr]: s[arr].includes(id)
        ? s[arr].filter((x) => x !== id)
        : [...s[arr], id],
    }));
  };

  const removeTitle = (id: string) => {
    setLibrary(library.filter((title) => title.id !== id));

    const nextStates = { ...states };

    Object.keys(nextStates).forEach((key) => {
      nextStates[key] = {
        watched: nextStates[key].watched.filter(
          (x) => x !== id
        ),
        watchlist: nextStates[key].watchlist.filter(
          (x) => x !== id
        ),
        rewatch: nextStates[key].rewatch.filter(
          (x) => x !== id
        ),
      };
    });

    setStates(nextStates);

    setReminders(
      reminders.filter((r) => r.titleId !== id)
    );

    setScheduled(
      scheduled.filter((r) => r.titleId !== id)
    );
  };

  const addProfile = (name: string, avatar: string) => {
    const newProfile = {
      id: uid(),
      name: name || "New Profile",
      avatar: avatar || "🙂",
    };

    setProfiles([...profiles, newProfile]);

    setStates({
      ...states,
      [newProfile.id]: {
        watched: [],
        watchlist: [],
        rewatch: [],
      },
    });

    setEditing(null);
  };

  /* --------------------------------------------------
     UI
  -------------------------------------------------- */

  return (
    <div className="app">

      {/* HEADER */}

      <header>
        <div className="logo">
          Stream<span>ix</span>
        </div>

        <div className="header-right">

          <button
            className="profile-pill"
            onClick={() => setShowProfile(true)}
          >
            <span>{profile.avatar}</span>
            {profile.name}
            <ChevronDown size={16} />
          </button>

          {isAdmin && (
            <button
              className="admin-badge"
              onClick={() => setMenu(!menu)}
            >
              ADMIN
            </button>
          )}

          {menu && isAdmin && (
            <div className="admin-menu">

              <button onClick={() => setShowAdd(true)}>
                <Plus size={17} />
                Add title
              </button>

              <button onClick={() => setShowHero(true)}>
                <Settings size={17} />
                Edit hero
              </button>

            </div>
          )}

        </div>
      </header>

      {/* HERO — intentionally kept */}
      
      <section
        className="hero"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(0,0,0,.92),rgba(0,0,0,.15)),url(${hero.backdrop})`,
        }}
      >
        <div className="hero-content">

          <div className="eyebrow">
            FEATURED
          </div>

          <h1>{hero.name}</h1>

          <p>
            {hero.year} ·{" "}
            {hero.kind === "movie"
              ? "Movie"
              : "TV Show"}
          </p>

          {isAdmin && (
            <button
              className="ghost"
              onClick={() => setShowHero(true)}
            >
              Edit Hero
            </button>
          )}

        </div>
      </section>

      <main>

        {/* LIBRARY / REWATCH */}

        <div className="switch">

          <button
            className={
              tab === "library" ? "active" : ""
            }
            onClick={() => {
              setTab("library");
              setFilter("all");
            }}
          >
            Library
          </button>

          <button
            className={
              tab === "rewatch" ? "active" : ""
            }
            onClick={() => setTab("rewatch")}
          >
            <Heart size={15} />
            Re-watch list
          </button>

        </div>

        {/* RECOMMENDATION STRIP */}

        {tab === "library" && recommendation && (
          <button
            className="recommendation-banner"
            onClick={() => setShowReco(true)}
          >
            <div className="recommendation-icon">
              <Sparkles size={24} />
            </div>

            <div>
              <strong>
                What should I watch?
              </strong>

              <span>
                Pick a mood, get a match from your library.
              </span>
            </div>
          </button>
        )}

        {/* REWATCH HELPER */}

        {tab === "rewatch" && (
          <div className="rewatch-helper">
            <div className="rewatch-helper-icon">
              <Heart size={19} />
            </div>

            <div>
              <strong>
                Build your re-watch list
              </strong>

              <span>
                Tap ♥ on any title to save it here.
              </span>
            </div>
          </div>
        )}

        {/* SEARCH */}

        <div className="search library-search">

          <Search size={19} />

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the library..."
          />

          {q && (
            <button
              className="clear-search"
              onClick={() => setQ("")}
            >
              <X size={16} />
            </button>
          )}

        </div>

        {/* WATCH STATUS */}

        {tab === "library" && (
          <div className="filter-row">

            <button
              className={
                filter === "all" ? "selected" : ""
              }
              onClick={() => setFilter("all")}
            >
              All
            </button>

            <button
              className={
                filter === "watchlist"
                  ? "selected"
                  : ""
              }
              onClick={() =>
                setFilter("watchlist")
              }
            >
              Watchlist
            </button>

            <button
              className={
                filter === "watched"
                  ? "selected"
                  : ""
              }
              onClick={() =>
                setFilter("watched")
              }
            >
              Watched
            </button>

          </div>
        )}

        {/* FORMAT */}

        {tab === "library" && (
          <div className="format-row">

            <span>FORMAT</span>

            <div className="format-switch">

              <button
                className={
                  kind === "all" ? "selected" : ""
                }
                onClick={() => setKind("all")}
              >
                All
              </button>

              <button
                className={
                  kind === "movie"
                    ? "selected"
                    : ""
                }
                onClick={() => setKind("movie")}
              >
                <Film size={14} />
                Movies
              </button>

              <button
                className={
                  kind === "tv"
                    ? "selected"
                    : ""
                }
                onClick={() => setKind("tv")}
              >
                <Tv size={14} />
                TV
              </button>

            </div>

          </div>
        )}

        {/* SECTION TITLE */}

        <div className="library-heading">
          <h2>
            {tab === "rewatch"
              ? "Re-watch list"
              : "Library"}
          </h2>

          {visible.length > 0 && (
            <span>
              {visible.length}{" "}
              {visible.length === 1
                ? "title"
                : "titles"}
            </span>
          )}
        </div>

        {/* TITLES */}

        <div className="grid">

          {visible.map((title) => (
            <Card
              key={title.id}
              t={title}
              st={state}
              isAdmin={isAdmin}
              onWatch={() =>
                toggle("watched", title.id)
              }
              onList={() =>
                toggle("watchlist", title.id)
              }
              onRewatch={() =>
                toggle("rewatch", title.id)
              }
              onRemove={() =>
                removeTitle(title.id)
              }
              onReminder={() =>
                setShowReminder(title)
              }
              onSchedule={() =>
                setShowSchedule(title)
              }
            />
          ))}

        </div>

        {/* EMPTY STATE */}

        {!visible.length && (
          <div className="empty">

            <div className="empty-icon">
              <Film size={27} />
            </div>

            <h2>
              {tab === "rewatch"
                ? "Your re-watch list is empty"
                : library.length === 0
                ? "Library is empty"
                : "Nothing here yet"}
            </h2>

            <p>
              {tab === "rewatch"
                ? "Tap the heart on any title to save it here."
                : library.length === 0
                ? "The owner hasn't added any titles yet. Check back soon."
                : "Try changing your filters or search."}
            </p>

          </div>
        )}

      </main>

      {/* RECOMMENDATION MODAL */}

      {showReco && recommendation && (
        <Modal
          title="Today's Reco"
          onClose={() => setShowReco(false)}
        >
          <div className="reco">

            <img src={recommendation.poster} />

            <div>

              <h2>{recommendation.name}</h2>

              <p>
                {recommendation.year} ·{" "}
                {recommendation.kind === "movie"
                  ? "Movie"
                  : "TV Show"}
              </p>

              <p>
                {recommendation.overview}
              </p>

              <button
                className="pink"
                onClick={() => {
                  toggle(
                    "watchlist",
                    recommendation.id
                  );
                  setShowReco(false);
                }}
              >
                Add to Watchlist
              </button>

            </div>

          </div>
        </Modal>
      )}

      {/* PROFILES */}

      {showProfile && (
        <Modal
          title="Profiles"
          onClose={() => setShowProfile(false)}
        >

          <div className="profiles">

            {profiles.map((x) => (
              <div
                className="profile-row"
                key={x.id}
              >

                <button
                  onClick={() => {
                    setProfileId(x.id);
                    setShowProfile(false);
                  }}
                  className={
                    x.id === profileId
                      ? "current"
                      : ""
                  }
                >
                  <span className="avatar">
                    {x.avatar}
                  </span>

                  <span>{x.name}</span>

                  {x.id === profileId && (
                    <Check size={18} />
                  )}
                </button>

                {x.id !== "admin" && (
                  <button
                    className="icon"
                    onClick={() => {
                      setEditing(x);
                      setShowProfile(false);
                    }}
                  >
                    ✎
                  </button>
                )}

              </div>
            ))}

            <button
              className="add-profile"
              onClick={() => {
                setEditing({
                  id: "new",
                  name: "",
                  avatar: "🙂",
                });

                setShowProfile(false);
              }}
            >
              <Plus />
              Add Profile
            </button>

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
          onClose={() => setEditing(null)}
          onSave={(name, avatar) =>
            editing.id === "new"
              ? addProfile(name, avatar)
              : (
                  setProfiles(
                    profiles.map((x) =>
                      x.id === editing.id
                        ? {
                            ...x,
                            name,
                            avatar,
                          }
                        : x
                    )
                  ),
                  setEditing(null)
                )
          }
          onDelete={
            editing.id === "new"
              ? undefined
              : () => {
                  setProfiles(
                    profiles.filter(
                      (x) =>
                        x.id !== editing.id
                    )
                  );

                  const nextStates = {
                    ...states,
                  };

                  delete nextStates[
                    editing.id
                  ];

                  setStates(nextStates);
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
          onClose={() => setShowAdd(false)}
          onAdd={(title) =>
            setLibrary([...library, title])
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
            setReminders([
              ...reminders,
              {
                id: uid(),
                profileId,
                titleId:
                  showReminder.id,
                date,
                time,
              },
            ]);

            setShowReminder(null);
          }}
        />
      )}

      {/* SCHEDULE */}

      {showSchedule && isAdmin && (
        <ScheduleModal
          title={showSchedule}
          profiles={profiles.filter(
            (x) => x.id !== "admin"
          )}
          onClose={() =>
            setShowSchedule(null)
          }
          onSave={(item) => {
            setScheduled([
              ...scheduled,
              item,
            ]);

            setShowSchedule(null);
          }}
        />
      )}

      {/* HERO */}

      {showHero && isAdmin && (
        <HeroModal
          hero={hero}
          library={library}
          onClose={() =>
            setShowHero(false)
          }
          onSave={(title) => {
            setHero(title);
            setShowHero(false);
          }}
        />
      )}

      {/* FOOTER */}

      <footer>

        <span>
          <Clock size={14} />

          {
            reminders.filter(
              (r) =>
                r.profileId === profileId
            ).length
          }

          reminder(s)
        </span>

        {isAdmin && (
          <span>
            {scheduled.length} scheduled reco(s)
          </span>
        )}

        <button
          onClick={() =>
            alert(
              "Demo mode: connect your real auth/backend before production use."
            )
          }
        >
          <LogOut size={14} />
          Sign out
        </button>

      </footer>

    </div>
  );
}

/* --------------------------------------------------
   CARD
-------------------------------------------------- */

function Card({
  t,
  st,
  isAdmin,
  onWatch,
  onList,
  onRewatch,
  onRemove,
  onReminder,
  onSchedule,
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
  return (
    <article className="card">

      <div className="poster-wrap">

        <img
          src={t.poster}
          onError={(e) => {
            e.currentTarget.src =
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
          >
            <Trash2 size={16} />
          </button>
        )}

      </div>

      <div className="card-body">

        <h3>{t.name}</h3>

        <p>{t.year}</p>

        <div className="actions">

          <button
            className={
              st.watchlist.includes(t.id)
                ? "on"
                : ""
            }
            onClick={onList}
          >
            + Watchlist
          </button>

          <button
            className={
              st.watched.includes(t.id)
                ? "on"
                : ""
            }
            onClick={onWatch}
          >
            {st.watched.includes(t.id)
              ? "✓ Watched"
              : "Mark watched"}
          </button>

        </div>

        <div className="small-actions">

          <button onClick={onRewatch}>
            <Heart size={14} />
            Re-watch
          </button>

          <button onClick={onReminder}>
            <Bell size={14} />
            Remind me
          </button>

          {isAdmin && (
            <button onClick={onSchedule}>
              Schedule reco
            </button>
          )}

        </div>

      </div>

    </article>
  );
}

/* --------------------------------------------------
   MODAL
-------------------------------------------------- */

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) {
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
          >
            <X />
          </button>

        </div>

        {children}

      </div>

    </div>
  );
}

/* --------------------------------------------------
   PROFILE EDITOR
-------------------------------------------------- */

function ProfileEditor({
  profile,
  onClose,
  onSave,
  onDelete,
}: {
  profile: Profile | null;
  onClose: () => void;
  onSave: (
    name: string,
    avatar: string
  ) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(
    profile?.name || ""
  );

  const [avatar, setAvatar] = useState(
    profile?.avatar || "🙂"
  );

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
          onChange={(e) =>
            setName(e.target.value)
          }
        />
      </label>

      <label>
        Profile Photo

        <div className="emoji-grid">

          {[
            "🙂",
            "🌸",
            "🎬",
            "🍿",
            "⭐",
            "🐱",
            "🦋",
            "🔥",
          ].map((emoji) => (
            <button
              className={
                avatar === emoji
                  ? "picked"
                  : ""
              }
              onClick={() =>
                setAvatar(emoji)
              }
              key={emoji}
            >
              {emoji}
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
          onSave(name, avatar)
        }
      >
        Save Profile
      </button>

      {onDelete && (
        <button
          className="danger full"
          onClick={() =>
            confirm(
              "Delete this profile?"
            ) && onDelete()
          }
        >
          Delete Profile
        </button>
      )}

    </Modal>
  );
}

/* --------------------------------------------------
   TMDB ADD TITLE
-------------------------------------------------- */

function AddTitle({
  library,
  onClose,
  onAdd,
}: {
  library: Title[];
  onClose: () => void;
  onAdd: (title: Title) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] =
    useState<Title[]>([]);
  const [loading, setLoading] =
    useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(
      async () => {
        setLoading(true);
        setError("");

        try {
          const data =
            await searchTMDB(q);

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
      clearTimeout(timer);
  }, [q]);

  const available =
    results.filter(
      (title) =>
        !library.some(
          (item) =>
            item.id === title.id
        )
    );

  return (
    <Modal
      title="Add Movie / TV Show"
      onClose={onClose}
    >

      <p className="muted">
        Search TMDB for movies and TV shows.
      </p>

      <div className="search wide">

        <Search size={18} />

        <input
          autoFocus
          value={q}
          onChange={(e) =>
            setQ(e.target.value)
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

        {available.map((title) => (
          <div
            className="result"
            key={title.id}
          >

            <img src={title.poster} />

            <div>

              <b>{title.name}</b>

              <span>
                {title.year} ·{" "}
                {title.kind === "movie"
                  ? "Movie"
                  : "TV Show"}
              </span>

            </div>

            <button
              className="pink add"
              onClick={() => {
                onAdd(title);

                setResults(
                  results.filter(
                    (x) =>
                      x.id !== title.id
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

/* --------------------------------------------------
   REMINDER
-------------------------------------------------- */

function ReminderModal({
  title,
  onClose,
  onSave,
}: {
  title: Title;
  onClose: () => void;
  onSave: (
    date: string,
    time: string
  ) => void;
}) {
  const [date, setDate] = useState("");
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
          onChange={(e) =>
            setDate(e.target.value)
          }
        />
      </label>

      <label>
        Time

        <input
          type="time"
          value={time}
          onChange={(e) =>
            setTime(e.target.value)
          }
        />
      </label>

      <button
        className="pink full"
        disabled={!date}
        onClick={() =>
          onSave(date, time)
        }
      >
        Save Reminder
      </button>

      <p className="muted">
        Browser calendar/push notifications
        require additional integration.
      </p>

    </Modal>
  );
}

/* --------------------------------------------------
   SCHEDULE RECOMMENDATION
-------------------------------------------------- */

function ScheduleModal({
  title,
  profiles,
  onClose,
  onSave,
}: {
  title: Title;
  profiles: Profile[];
  onClose: () => void;
  onSave: (item: Scheduled) => void;
}) {
  const [profileId, setProfileId] =
    useState(profiles[0]?.id || "");

  const [date, setDate] = useState("");
  const [time, setTime] =
    useState("19:00");

  const [message, setMessage] =
    useState("How about this one?");

  return (
    <Modal
      title="Schedule Personal Recommendation"
      onClose={onClose}
    >

      <label>
        Profile

        <select
          value={profileId}
          onChange={(e) =>
            setProfileId(e.target.value)
          }
        >
          {profiles.map((p) => (
            <option
              value={p.id}
              key={p.id}
            >
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Date

        <input
          type="date"
          value={date}
          onChange={(e) =>
            setDate(e.target.value)
          }
        />
      </label>

      <label>
        Time

        <input
          type="time"
          value={time}
          onChange={(e) =>
            setTime(e.target.value)
          }
        />
      </label>

      <label>
        Message

        <textarea
          value={message}
          onChange={(e) =>
            setMessage(e.target.value)
          }
        />
      </label>

      <button
        className="pink full"
        disabled={!profileId || !date}
        onClick={() =>
          onSave({
            id: uid(),
            profileId,
            titleId: title.id,
            date,
            time,
            message,
          })
        }
      >
        Schedule
      </button>

    </Modal>
  );
}

/* --------------------------------------------------
   HERO
-------------------------------------------------- */

function HeroModal({
  hero,
  library,
  onClose,
  onSave,
}: {
  hero: Title;
  library: Title[];
  onClose: () => void;
  onSave: (title: Title) => void;
}) {
  const [id, setId] =
    useState(hero.id);

  return (
    <Modal
      title="Edit Hero"
      onClose={onClose}
    >

      <p>
        <b>
          Recommended image size:
          1600 × 600 px
        </b>
        <br />
        Aspect ratio: approximately 8:3
        <br />
        Format: JPG or PNG
        <br />
        Recommended file size:
        under 2 MB
      </p>

      <label>
        Hero title

        <select
          value={id}
          onChange={(e) =>
            setId(e.target.value)
          }
        >
          {library.map((title) => (
            <option
              key={title.id}
              value={title.id}
            >
              {title.name}
            </option>
          ))}
        </select>
      </label>

      <p className="muted">
        The hero uses the selected title's
        TMDB backdrop image.
      </p>

      <button
        className="pink full"
        onClick={() =>
          onSave(
            library.find(
              (x) => x.id === id
            ) || hero
          )
        }
      >
        Save Hero
      </button>

    </Modal>
  );
}

createRoot(
  document.getElementById("root")!
).render(<App />);
