import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  Clock,
  Film,
  LogOut,
  Plus,
  Search,
  Settings,
  Trash2,
  Tv,
  X,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { createRoot } from "react-dom/client";
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
  rating?: number;
  genreIds?: number[];
  genres?: string[];
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

const GENRES: Record<number, string> = {
  12: "Adventure",
  14: "Fantasy",
  16: "Animation",
  18: "Drama",
  27: "Horror",
  28: "Action",
  35: "Comedy",
  36: "History",
  37: "Western",
  53: "Thriller",
  80: "Crime",
  99: "Documentary",
  878: "Sci-Fi",
  9648: "Mystery",
  10402: "Music",
  10749: "Romance",
  10751: "Family",
  10752: "War",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

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
    rating: 8.2,
    genres: ["Action", "Sci-Fi"],
    genreIds: [28, 878],
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
    rating: 8.7,
    genres: ["Adventure", "Drama", "Sci-Fi"],
    genreIds: [12, 18, 878],
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
    watchlist: ["interstellar"],
    rewatch: ["matrix"],
  },
  sarah: {
    watched: [],
    watchlist: [],
    rewatch: [],
  },
  john: {
    watched: [],
    watchlist: [],
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
  const [yearFilter, setYearFilter] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");

  const [showProfile, setShowProfile] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showReco, setShowReco] = useState(true);
  const [showReminder, setShowReminder] = useState<Title | null>(null);
  const [showSchedule, setShowSchedule] = useState<Title | null>(null);
  const [showHero, setShowHero] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [menu, setMenu] = useState(false);

  const isAdmin = profileId === "admin";
  const p = profiles.find((x) => x.id === profileId) || profiles[0];

  const st =
    states[profileId] || {
      watched: [],
      watchlist: [],
      rewatch: [],
    };

  const clearFilters = () => {
    setQ("");
    setYearFilter("");
    setGenreFilter("");
    setRatingFilter("");
    setKind("all");
    setFilter("all");
  };

  const visible = useMemo(() => {
    return library
      .filter((t) =>
        t.name.toLowerCase().includes(q.toLowerCase())
      )
      .filter((t) => kind === "all" || t.kind === kind)
      .filter((t) => !yearFilter || String(t.year) === yearFilter)
      .filter(
        (t) =>
          !genreFilter ||
          t.genreIds?.includes(Number(genreFilter))
      )
      .filter(
        (t) =>
          !ratingFilter ||
          (t.rating || 0) >= Number(ratingFilter)
      )
      .filter((t) =>
        tab === "rewatch"
          ? st.rewatch.includes(t.id)
          : filter === "all"
          ? true
          : filter === "watched"
          ? st.watched.includes(t.id)
          : st.watchlist.includes(t.id)
      );
  }, [
    library,
    q,
    kind,
    yearFilter,
    genreFilter,
    ratingFilter,
    tab,
    filter,
    st,
  ]);

  const rec =
    library.find(
      (t) =>
        st.watchlist.includes(t.id) &&
        !st.watched.includes(t.id)
    ) || library.find((t) => !st.watched.includes(t.id));

  const updateState = (fn: (s: State) => State) =>
    setStates({
      ...states,
      [profileId]: fn(st),
    });

  const toggle = (arr: keyof State, id: string) =>
    updateState((s) => ({
      ...s,
      [arr]: s[arr].includes(id)
        ? s[arr].filter((x) => x !== id)
        : [...s[arr], id],
    }));

  const removeTitle = (id: string) => {
    setLibrary(library.filter((t) => t.id !== id));

    const ns = { ...states };

    Object.keys(ns).forEach((k) => {
      ns[k] = {
        watched: ns[k].watched.filter((x) => x !== id),
        watchlist: ns[k].watchlist.filter((x) => x !== id),
        rewatch: ns[k].rewatch.filter((x) => x !== id),
      };
    });

    setStates(ns);
    setReminders(reminders.filter((r) => r.titleId !== id));
    setScheduled(scheduled.filter((r) => r.titleId !== id));
  };

  const addProfile = (name: string, avatar: string) => {
    const np = {
      id: uid(),
      name: name || "New Profile",
      avatar: avatar || "🙂",
    };

    setProfiles([...profiles, np]);

    setStates({
      ...states,
      [np.id]: {
        watched: [],
        watchlist: [],
        rewatch: [],
      },
    });

    setEditing(null);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          STREAM<span>IX</span>
        </div>

        <div className="header-right">
          <button
            className="profile-pill"
            onClick={() => setShowProfile(true)}
          >
            <span>{p.avatar}</span>
            {p.name}
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
                <Plus /> Add title
              </button>

              <button onClick={() => setShowHero(true)}>
                <Settings /> Edit hero
              </button>
            </div>
          )}
        </div>
      </header>

      <section
        className="hero"
        style={{
          backgroundImage: `
            linear-gradient(
              90deg,
              rgba(5,5,8,.98) 0%,
              rgba(5,5,8,.78) 42%,
              rgba(5,5,8,.12) 100%
            ),
            url(${hero.backdrop})
          `,
        }}
      >
        <div className="hero-content">
          <div className="eyebrow">
            <Sparkles size={14} />
            FEATURED
          </div>

          <h1>{hero.name}</h1>

          <p>
            {hero.year} ·{" "}
            {hero.kind === "movie" ? "Movie" : "TV Show"}
            {hero.rating ? ` · ★ ${hero.rating.toFixed(1)}` : ""}
          </p>

          {hero.overview && (
            <div className="hero-overview">
              {hero.overview}
            </div>
          )}

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
        <div className="library-heading">
          <div>
            <div className="section-kicker">YOUR COLLECTION</div>
            <h2>Library</h2>
            <p>Everything your household wants to watch.</p>
          </div>

          <div className="switch">
            <button
              className={tab === "library" ? "active" : ""}
              onClick={() => {
                setTab("library");
                setFilter("all");
              }}
            >
              Library
            </button>

            <button
              className={tab === "rewatch" ? "active" : ""}
              onClick={() => setTab("rewatch")}
            >
              Re-watch
            </button>
          </div>
        </div>

        {tab === "library" && (
          <>
            <div className="search-panel">
              <div className="search-main">
                <Search size={19} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search your library..."
                />
              </div>

              <div className="filter-label">
                <SlidersHorizontal size={15} />
                FILTERS
              </div>

              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
              >
                <option value="">Year</option>
                {Array.from(
                  new Set(
                    library
                      .map((x) => x.year)
                      .filter(Boolean)
                  )
                )
                  .sort((a, b) => b - a)
                  .map((year) => (
                    <option value={year} key={year}>
                      {year}
                    </option>
                  ))}
              </select>

              <select
                value={genreFilter}
                onChange={(e) => setGenreFilter(e.target.value)}
              >
                <option value="">Genre</option>
                {Object.entries(GENRES).map(([id, name]) => (
                  <option value={id} key={id}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
              >
                <option value="">Rating</option>
                <option value="9">9+</option>
                <option value="8">8+</option>
                <option value="7">7+</option>
                <option value="6">6+</option>
                <option value="5">5+</option>
              </select>

              {(q ||
                yearFilter ||
                genreFilter ||
                ratingFilter ||
                kind !== "all" ||
                filter !== "all") && (
                <button
                  className="clear-filters"
                  onClick={clearFilters}
                >
                  <X size={14} />
                  Clear
                </button>
              )}
            </div>

            <div className="filter-row">
              <div className="segmented">
                <button
                  className={filter === "all" ? "selected" : ""}
                  onClick={() => setFilter("all")}
                >
                  All
                </button>

                <button
                  className={
                    filter === "watchlist" ? "selected" : ""
                  }
                  onClick={() => setFilter("watchlist")}
                >
                  Watchlist
                </button>

                <button
                  className={
                    filter === "watched" ? "selected" : ""
                  }
                  onClick={() => setFilter("watched")}
                >
                  Watched
                </button>
              </div>

              <div className="segmented">
                <button
                  className={kind === "all" ? "selected" : ""}
                  onClick={() => setKind("all")}
                >
                  All
                </button>

                <button
                  className={kind === "movie" ? "selected" : ""}
                  onClick={() => setKind("movie")}
                >
                  <Film size={14} />
                  Movies
                </button>

                <button
                  className={kind === "tv" ? "selected" : ""}
                  onClick={() => setKind("tv")}
                >
                  <Tv size={14} />
                  TV
                </button>
              </div>

              <span className="result-count">
                {visible.length}{" "}
                {visible.length === 1 ? "title" : "titles"}
              </span>
            </div>
          </>
        )}

        <div className="grid">
          {visible.map((t) => (
            <Card
              key={t.id}
              t={t}
              st={st}
              isAdmin={isAdmin}
              onWatch={() => toggle("watched", t.id)}
              onList={() => toggle("watchlist", t.id)}
              onRewatch={() => toggle("rewatch", t.id)}
              onRemove={() => removeTitle(t.id)}
              onReminder={() => setShowReminder(t)}
              onSchedule={() => setShowSchedule(t)}
            />
          ))}

          {!visible.length && (
            <div className="empty">
              <Search size={28} />
              <h3>No titles found</h3>
              <p>Try changing your search or filters.</p>
              <button
                className="pink"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </main>

      {showReco && rec && (
        <Modal
          title="Tonight's pick"
          onClose={() => setShowReco(false)}
        >
          <div className="reco">
            <img src={rec.poster} />
            <div>
              <div className="eyebrow">JUST FOR YOU</div>
              <h2>{rec.name}</h2>
              <p>
                {rec.year} ·{" "}
                {rec.kind === "movie" ? "Movie" : "TV Show"}
                {rec.rating
                  ? ` · ★ ${rec.rating.toFixed(1)}`
                  : ""}
              </p>

              <p>{rec.overview}</p>

              <button
                className="pink"
                onClick={() => {
                  toggle("watchlist", rec.id);
                  setShowReco(false);
                }}
              >
                Add to Watchlist
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showProfile && (
        <Modal
          title="Who's watching?"
          onClose={() => setShowProfile(false)}
        >
          <div className="profiles">
            {profiles.map((x) => (
              <div className="profile-row" key={x.id}>
                <button
                  onClick={() => {
                    setProfileId(x.id);
                    setShowProfile(false);
                  }}
                  className={
                    x.id === profileId ? "current" : ""
                  }
                >
                  <span className="avatar">{x.avatar}</span>
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
              <Plus /> Add Profile
            </button>
          </div>
        </Modal>
      )}

      {editing && (
        <ProfileEditor
          profile={editing.id === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(n, a) =>
            editing.id === "new"
              ? addProfile(n, a)
              : (setProfiles(
                  profiles.map((x) =>
                    x.id === editing.id
                      ? { ...x, name: n, avatar: a }
                      : x
                  )
                ),
                setEditing(null))
          }
          onDelete={
            editing.id === "new"
              ? undefined
              : () => {
                  setProfiles(
                    profiles.filter(
                      (x) => x.id !== editing.id
                    )
                  );

                  const ns = { ...states };
                  delete ns[editing.id];

                  setStates(ns);
                  setEditing(null);
                  setProfileId("admin");
                }
          }
        />
      )}

      {showAdd && (
        <AddTitle
          library={library}
          onClose={() => setShowAdd(false)}
          onAdd={(t) => setLibrary([...library, t])}
        />
      )}

      {showReminder && (
        <ReminderModal
          title={showReminder}
          onClose={() => setShowReminder(null)}
          onSave={(d, time) => {
            setReminders([
              ...reminders,
              {
                id: uid(),
                profileId,
                titleId: showReminder.id,
                date: d,
                time,
              },
            ]);

            setShowReminder(null);
          }}
        />
      )}

      {showSchedule && isAdmin && (
        <ScheduleModal
          title={showSchedule}
          profiles={profiles.filter(
            (x) => x.id !== "admin"
          )}
          onClose={() => setShowSchedule(null)}
          onSave={(r) => {
            setScheduled([...scheduled, r]);
            setShowSchedule(null);
          }}
        />
      )}

      {showHero && isAdmin && (
        <HeroModal
          hero={hero}
          library={library}
          onClose={() => setShowHero(false)}
          onSave={(t) => {
            setHero(t);
            setShowHero(false);
          }}
        />
      )}

      <footer>
        <span>
          <Clock size={14} />{" "}
          {
            reminders.filter(
              (r) => r.profileId === profileId
            ).length
          }{" "}
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
          <LogOut size={14} /> Sign out
        </button>
      </footer>
    </div>
  );
}

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

        <div className="poster-gradient" />

        <span className="kind">
          {t.kind === "movie" ? "MOVIE" : "TV"}
        </span>

        {t.rating !== undefined && (
          <span className="rating">
            ★ {t.rating.toFixed(1)}
          </span>
        )}

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

        <p className="meta">
          {t.year}
          {t.genres?.length
            ? ` · ${t.genres.slice(0, 2).join(" · ")}`
            : ""}
        </p>

        {t.overview && (
          <p className="overview">{t.overview}</p>
        )}

        <div className="actions">
          <button
            className={
              st.watchlist.includes(t.id) ? "on" : ""
            }
            onClick={onList}
          >
            {st.watchlist.includes(t.id)
              ? "✓ In Watchlist"
              : "+ Watchlist"}
          </button>

          <button
            className={
              st.watched.includes(t.id) ? "on" : ""
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
            ↻ Re-watch
          </button>

          <button onClick={onReminder}>
            <Bell size={14} />
            Remind
          </button>

          {isAdmin && (
            <button onClick={onSchedule}>
              Schedule
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

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
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <h2>{title}</h2>

          <button className="icon" onClick={onClose}>
            <X />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function ProfileEditor({
  profile,
  onClose,
  onSave,
  onDelete,
}: {
  profile: Profile | null;
  onClose: () => void;
  onSave: (n: string, a: string) => void;
  onDelete?: () => void;
}) {
  const [n, setN] = useState(profile?.name || "");
  const [a, setA] = useState(profile?.avatar || "🙂");

  return (
    <Modal
      title={profile ? "Edit Profile" : "Add Profile"}
      onClose={onClose}
    >
      <label>
        Profile Name
        <input
          autoFocus
          value={n}
          onChange={(e) => setN(e.target.value)}
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
          ].map((x) => (
            <button
              className={a === x ? "picked" : ""}
              onClick={() => setA(x)}
              key={x}
            >
              {x}
            </button>
          ))}
        </div>
      </label>

      <button
        className="pink full"
        onClick={() => onSave(n, a)}
      >
        Save Profile
      </button>

      {onDelete && (
        <button
          className="danger full"
          onClick={() =>
            confirm("Delete this profile?") &&
            onDelete()
          }
        >
          Delete Profile
        </button>
      )}
    </Modal>
  );
}

function AddTitle({
  library,
  onClose,
  onAdd,
}: {
  library: Title[];
  onClose: () => void;
  onAdd: (t: Title) => void;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"multi" | Kind>(
    "multi"
  );
  const [year, setYear] = useState("");
  const [genre, setGenre] = useState("");
  const [rating, setRating] = useState("");
  const [results, setResults] = useState<Title[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const searchTMDB = async () => {
    if (!q.trim()) return;

    setLoading(true);
    setSearched(true);

    try {
      const response = await fetch(
        `/api/tmdb/search?query=${encodeURIComponent(
          q.trim()
        )}&type=${kind}`
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();

      const mapped: Title[] = (data.results || [])
        .filter(
          (item: any) =>
            item.media_type !== "person"
        )
        .map((item: any) => {
          const isMovie =
            item.media_type === "movie" ||
            kind === "movie";

          const titleName =
            item.title || item.name || "Untitled";

          const release =
            item.release_date ||
            item.first_air_date ||
            "";

          const genreIds =
            item.genre_ids || [];

          return {
            id: String(item.id),
            name: titleName,
            kind: isMovie ? "movie" : "tv",
            year: release
              ? Number(release.slice(0, 4))
              : 0,
            poster: item.poster_path
              ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
              : "https://placehold.co/500x750/171717/ffffff?text=No+Poster",
            backdrop: item.backdrop_path
              ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
              : "",
            overview:
              item.overview ||
              "No description available.",
            rating:
              typeof item.vote_average === "number"
                ? item.vote_average
                : 0,
            genreIds,
            genres: genreIds
              .map((id: number) => GENRES[id])
              .filter(Boolean),
          };
        });

      setResults(mapped);
    } catch (error) {
      console.error(error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = results.filter((t) => {
    if (year && String(t.year) !== year)
      return false;

    if (
      genre &&
      !t.genreIds?.includes(Number(genre))
    )
      return false;

    if (
      rating &&
      (t.rating || 0) < Number(rating)
    )
      return false;

    return true;
  });

  const availableYears = Array.from(
    new Set(
      results
        .map((x) => x.year)
        .filter(Boolean)
    )
  ).sort((a, b) => b - a);

  return (
    <Modal
      title="Add to your library"
      onClose={onClose}
    >
      <div className="add-intro">
        <div className="add-icon">
          <Sparkles />
        </div>

        <div>
          <h3>Find something to watch</h3>
          <p>
            Search the entire TMDB catalog and add
            titles to your private library.
          </p>
        </div>
      </div>

      <div className="add-search">
        <Search size={19} />

        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")
              searchTMDB();
          }}
          placeholder="Search movies & TV shows..."
        />

        <button
          className="pink search-button"
          onClick={searchTMDB}
          disabled={loading || !q.trim()}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      <div className="add-filters">
        <select
          value={kind}
          onChange={(e) =>
            setKind(e.target.value as any)
          }
        >
          <option value="multi">
            Movies + TV
          </option>
          <option value="movie">Movies</option>
          <option value="tv">TV Shows</option>
        </select>

        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="">Year</option>
          {availableYears.map((y) => (
            <option value={y} key={y}>
              {y}
            </option>
          ))}
        </select>

        <select
          value={genre}
          onChange={(e) =>
            setGenre(e.target.value)
          }
        >
          <option value="">Genre</option>

          {Object.entries(GENRES).map(
            ([id, name]) => (
              <option value={id} key={id}>
                {name}
              </option>
            )
          )}
        </select>

        <select
          value={rating}
          onChange={(e) =>
            setRating(e.target.value)
          }
        >
          <option value="">Rating</option>
          <option value="9">9+</option>
          <option value="8">8+</option>
          <option value="7">7+</option>
          <option value="6">6+</option>
          <option value="5">5+</option>
        </select>

        {(year || genre || rating) && (
          <button
            className="clear-filters"
            onClick={() => {
              setYear("");
              setGenre("");
              setRating("");
            }}
          >
            <X size={14} />
            Clear
          </button>
        )}
      </div>

      <div className="result-list">
        {!searched && (
          <div className="search-empty">
            <Search size={32} />
            <h3>Search TMDB</h3>
            <p>
              Type a movie or TV show above to
              get started.
            </p>
          </div>
        )}

        {searched &&
          !loading &&
          !filtered.length && (
            <div className="search-empty">
              <h3>No results</h3>
              <p>
                Try a different search or remove
                some filters.
              </p>
            </div>
          )}

        {filtered.map((t) => {
          const alreadyAdded = library.some(
            (l) => l.id === t.id
          );

          return (
            <div className="result" key={t.id}>
              <img src={t.poster} />

              <div className="result-info">
                <b>{t.name}</b>

                <span>
                  {t.year || "Unknown year"} ·{" "}
                  {t.kind === "movie"
                    ? "Movie"
                    : "TV Show"}
                </span>

                {t.rating !== undefined && (
                  <span className="result-rating">
                    ★ {t.rating.toFixed(1)}
                  </span>
                )}

                {t.genres &&
                  t.genres.length > 0 && (
                    <small>
                      {t.genres
                        .slice(0, 3)
                        .join(" · ")}
                    </small>
                  )}
              </div>

              <button
                className={
                  alreadyAdded
                    ? "added"
                    : "pink add"
                }
                disabled={alreadyAdded}
                onClick={() => onAdd(t)}
              >
                {alreadyAdded ? (
                  <>
                    <Check size={15} />
                    Added
                  </>
                ) : (
                  <>
                    <Plus size={15} />
                    Add
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function ReminderModal({
  title,
  onClose,
  onSave,
}: {
  title: Title;
  onClose: () => void;
  onSave: (d: string, t: string) => void;
}) {
  const [d, setD] = useState("");
  const [t, setT] = useState("19:00");

  return (
    <Modal title="Remind Me" onClose={onClose}>
      <p>
        Set a reminder for{" "}
        <b>{title.name}</b>.
      </p>

      <label>
        Date
        <input
          type="date"
          value={d}
          onChange={(e) => setD(e.target.value)}
        />
      </label>

      <label>
        Time
        <input
          type="time"
          value={t}
          onChange={(e) => setT(e.target.value)}
        />
      </label>

      <button
        className="pink full"
        disabled={!d}
        onClick={() => onSave(d, t)}
      >
        Save Reminder
      </button>
    </Modal>
  );
}

function ScheduleModal({
  title,
  profiles,
  onClose,
  onSave,
}: {
  title: Title;
  profiles: Profile[];
  onClose: () => void;
  onSave: (r: Scheduled) => void;
}) {
  const [pid, setPid] = useState(
    profiles[0]?.id || ""
  );
  const [d, setD] = useState("");
  const [t, setT] = useState("19:00");
  const [m, setM] = useState(
    "How about this one?"
  );

  return (
    <Modal
      title="Schedule Recommendation"
      onClose={onClose}
    >
      <label>
        Profile
        <select
          value={pid}
          onChange={(e) =>
            setPid(e.target.value)
          }
        >
          {profiles.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Date
        <input
          type="date"
          value={d}
          onChange={(e) => setD(e.target.value)}
        />
      </label>

      <label>
        Time
        <input
          type="time"
          value={t}
          onChange={(e) => setT(e.target.value)}
        />
      </label>

      <label>
        Message
        <textarea
          value={m}
          onChange={(e) => setM(e.target.value)}
        />
      </label>

      <button
        className="pink full"
        disabled={!pid || !d}
        onClick={() =>
          onSave({
            id: uid(),
            profileId: pid,
            titleId: title.id,
            date: d,
            time: t,
            message: m,
          })
        }
      >
        Schedule
      </button>
    </Modal>
  );
}

function HeroModal({
  hero,
  library,
  onClose,
  onSave,
}: {
  hero: Title;
  library: Title[];
  onClose: () => void;
  onSave: (t: Title) => void;
}) {
  const [id, setId] = useState(hero.id);

  return (
    <Modal title="Edit Hero" onClose={onClose}>
      <label>
        Featured title

        <select
          value={id}
          onChange={(e) =>
            setId(e.target.value)
          }
        >
          {library.map((t) => (
            <option
              key={t.id}
              value={t.id}
            >
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <button
        className="pink full"
        onClick={() =>
          onSave(
            library.find((x) => x.id === id) ||
              hero
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
