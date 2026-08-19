import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
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
  Star,
  Trash2,
  Tv,
  X
} from 'lucide-react';
import './styles.css';

type Kind = 'movie' | 'tv';

type Title = {
  id: string;
  tmdbId?: number;
  name: string;
  kind: Kind;
  year: number;
  poster: string;
  backdrop: string;
  overview: string;
  rating?: number;
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

/* --------------------------------------------------
   MOCK STARTER LIBRARY
-------------------------------------------------- */

const mock: Title[] = [
  {
    id: 'matrix',
    name: 'The Matrix',
    kind: 'movie',
    year: 1999,
    poster: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg',
    overview: 'A hacker discovers that the world he knows is an elaborate simulation.',
    rating: 8.2,
    genres: ['Action', 'Science Fiction']
  },
  {
    id: 'interstellar',
    name: 'Interstellar',
    kind: 'movie',
    year: 2014,
    poster: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/xJHokMbljvjADYdit5fK5QTB1lx.jpg',
    overview: 'Explorers travel through a wormhole in space in an attempt to ensure humanity’s survival.',
    rating: 8.4,
    genres: ['Adventure', 'Drama', 'Science Fiction']
  }
];

const initialProfiles: Profile[] = [
  { id: 'admin', name: 'Admin', avatar: '👑' },
  { id: 'sarah', name: 'Sarah', avatar: '🌸' },
  { id: 'john', name: 'John', avatar: '🎬' }
];

const initialState: Record<string, State> = {
  admin: {
    watched: ['matrix'],
    watchlist: ['interstellar'],
    rewatch: ['matrix']
  },
  sarah: {
    watched: [],
    watchlist: ['matrix'],
    rewatch: []
  },
  john: {
    watched: [],
    watchlist: ['interstellar'],
    rewatch: []
  }
};

const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
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
    throw new Error('TMDB search failed');
  }

  const data = await response.json();

  return (data.results || [])
    .filter(
      (item: any) =>
        item.media_type === 'movie' || item.media_type === 'tv'
    )
    .map((item: any): Title => {
      const kind: Kind =
        item.media_type === 'tv' ? 'tv' : 'movie';

      const date =
        kind === 'movie'
          ? item.release_date
          : item.first_air_date;

      return {
        id: `tmdb-${kind}-${item.id}`,
        tmdbId: item.id,
        name: kind === 'movie' ? item.title : item.name,
        kind,
        year: date ? Number(date.slice(0, 4)) : 0,
        poster: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : 'https://placehold.co/500x750/171717/ffffff?text=No+Poster',
        backdrop: item.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
          : '',
        overview: item.overview || '',
        rating:
          typeof item.vote_average === 'number'
            ? item.vote_average
            : undefined,
        genres: []
      };
    });
}

/* --------------------------------------------------
   APP
-------------------------------------------------- */

function App() {
  const [library, setLibrary] = useStored<Title[]>(
    'sx-library',
    mock
  );

  const [profiles, setProfiles] = useStored<Profile[]>(
    'sx-profiles',
    initialProfiles
  );

  const [states, setStates] = useStored<Record<string, State>>(
    'sx-states',
    initialState
  );

  const [reminders, setReminders] = useStored<Reminder[]>(
    'sx-reminders',
    []
  );

  const [scheduled, setScheduled] = useStored<Scheduled[]>(
    'sx-scheduled',
    []
  );

  const [hero, setHero] = useStored<Title>(
    'sx-hero',
    mock[1]
  );

  const [profileId, setProfileId] = useState('admin');

  const [tab, setTab] =
    useState<'library' | 'rewatch'>('library');

  const [filter, setFilter] =
    useState<'all' | 'watchlist' | 'watched'>('all');

  const [kind, setKind] =
    useState<'all' | Kind>('all');

  const [q, setQ] = useState('');

  const [yearFilter, setYearFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');

  const [showProfile, setShowProfile] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showReco, setShowReco] = useState(true);
  const [showReminder, setShowReminder] =
    useState<Title | null>(null);
  const [showSchedule, setShowSchedule] =
    useState<Title | null>(null);
  const [showHero, setShowHero] = useState(false);
  const [editing, setEditing] =
    useState<Profile | null>(null);
  const [menu, setMenu] = useState(false);

  const isAdmin = profileId === 'admin';

  const p =
    profiles.find(x => x.id === profileId) ||
    profiles[0];

  const st =
    states[profileId] || {
      watched: [],
      watchlist: [],
      rewatch: []
    };

  /* --------------------------------------------------
     LIBRARY FILTERING
  -------------------------------------------------- */

  const genres = useMemo(() => {
    const all = library.flatMap(
      t => t.genres || []
    );

    return [...new Set(all)].sort();
  }, [library]);

  const years = useMemo(() => {
    return [...new Set(
      library
        .map(t => t.year)
        .filter(Boolean)
    )].sort((a, b) => b - a);
  }, [library]);

  const visible = useMemo(() => {
    return library
      .filter(t =>
        t.name
          .toLowerCase()
          .includes(q.toLowerCase())
      )
      .filter(
        t =>
          kind === 'all' ||
          t.kind === kind
      )
      .filter(
        t =>
          !yearFilter ||
          String(t.year) === yearFilter
      )
      .filter(
        t =>
          !genreFilter ||
          (t.genres || []).includes(
            genreFilter
          )
      )
      .filter(
        t =>
          !ratingFilter ||
          (t.rating || 0) >=
            Number(ratingFilter)
      )
      .filter(t =>
        tab === 'rewatch'
          ? st.rewatch.includes(t.id)
          : filter === 'all'
          ? true
          : filter === 'watched'
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
    st
  ]);

  const rec =
    library.find(
      t =>
        st.watchlist.includes(t.id) &&
        !st.watched.includes(t.id)
    ) ||
    library.find(
      t => !st.watched.includes(t.id)
    );

  const clearFilters = () => {
    setYearFilter('');
    setGenreFilter('');
    setRatingFilter('');
  };

  const updateState = (
    fn: (s: State) => State
  ) =>
    setStates({
      ...states,
      [profileId]: fn(st)
    });

  const toggle = (
    arr: keyof State,
    id: string
  ) =>
    updateState(s => ({
      ...s,
      [arr]: s[arr].includes(id)
        ? s[arr].filter(x => x !== id)
        : [...s[arr], id]
    }));

  const removeTitle = (id: string) => {
    setLibrary(
      library.filter(t => t.id !== id)
    );

    const ns = { ...states };

    Object.keys(ns).forEach(k => {
      ns[k] = {
        watched: ns[k].watched.filter(
          x => x !== id
        ),
        watchlist: ns[k].watchlist.filter(
          x => x !== id
        ),
        rewatch: ns[k].rewatch.filter(
          x => x !== id
        )
      };
    });

    setStates(ns);

    setReminders(
      reminders.filter(
        r => r.titleId !== id
      )
    );

    setScheduled(
      scheduled.filter(
        r => r.titleId !== id
      )
    );
  };

  const addProfile = (
    name: string,
    avatar: string
  ) => {
    const np = {
      id: uid(),
      name: name || 'New Profile',
      avatar: avatar || '🙂'
    };

    setProfiles([
      ...profiles,
      np
    ]);

    setStates({
      ...states,
      [np.id]: {
        watched: [],
        watchlist: [],
        rewatch: []
      }
    });

    setEditing(null);
  };

  return (
    <div className="app">

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
            <span>{p.avatar}</span>
            {p.name}
            <ChevronDown size={16} />
          </button>

          {isAdmin && (
            <button
              className="admin-badge"
              onClick={() =>
                setMenu(!menu)
              }
            >
              ADMIN
            </button>
          )}

          {menu && isAdmin && (
            <div className="admin-menu">
              <button
                onClick={() =>
                  setShowAdd(true)
                }
              >
                <Plus /> Add title
              </button>

              <button
                onClick={() =>
                  setShowHero(true)
                }
              >
                <Settings /> Edit hero
              </button>
            </div>
          )}
        </div>
      </header>

      <section
        className="hero"
        style={{
          backgroundImage:
            `linear-gradient(90deg,rgba(0,0,0,.92),rgba(0,0,0,.15)),url(${hero.backdrop})`
        }}
      >
        <div className="hero-content">
          <div className="eyebrow">
            FEATURED
          </div>

          <h1>{hero.name}</h1>

          <p>
            {hero.year} ·{' '}
            {hero.kind === 'movie'
              ? 'Movie'
              : 'TV Show'}
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
        </div>
      </section>

      <main>

        {/* --------------------------------------------------
            LIBRARY / REWATCH
        -------------------------------------------------- */}

        <div className="library-tabs">
          <button
            className={
              tab === 'library'
                ? 'active'
                : ''
            }
            onClick={() => {
              setTab('library');
              setFilter('all');
            }}
          >
            Library
          </button>

          <span>|</span>

          <button
            className={
              tab === 'rewatch'
                ? 'active'
                : ''
            }
            onClick={() =>
              setTab('rewatch')
            }
          >
            Re-watch
          </button>
        </div>

        <p className="section-description">
          {tab === 'rewatch'
            ? 'Build your re-watch list'
            : 'Your movie and TV library'}
        </p>

        {/* SEARCH */}

        <div className="library-search">
          <Search size={18} />

          <input
            value={q}
            onChange={e =>
              setQ(e.target.value)
            }
            placeholder="Search library"
          />
        </div>

        {/* FILTERS */}

        <div className="library-filters">

          <select
            value={yearFilter}
            onChange={e =>
              setYearFilter(
                e.target.value
              )
            }
          >
            <option value="">
              YEAR
            </option>

            {years.map(year => (
              <option
                key={year}
                value={year}
              >
                {year}
              </option>
            ))}
          </select>

          <select
            value={genreFilter}
            onChange={e =>
              setGenreFilter(
                e.target.value
              )
            }
          >
            <option value="">
              GENRE
            </option>

            {genres.map(genre => (
              <option
                key={genre}
                value={genre}
              >
                {genre}
              </option>
            ))}
          </select>

          <select
            value={ratingFilter}
            onChange={e =>
              setRatingFilter(
                e.target.value
              )
            }
          >
            <option value="">
              RATING
            </option>

            <option value="9">
              9+
            </option>

            <option value="8">
              8+
            </option>

            <option value="7">
              7+
            </option>

            <option value="6">
              6+
            </option>

            <option value="5">
              5+
            </option>
          </select>

          <button
            className="clear-filters"
            onClick={clearFilters}
          >
            CLEAR FILTERS
          </button>

        </div>

        {/* WATCH STATUS */}

        {tab === 'library' && (
          <div className="filter-row">

            <button
              className={
                filter === 'all'
                  ? 'selected'
                  : ''
              }
              onClick={() =>
                setFilter('all')
              }
            >
              ALL
            </button>

            <button
              className={
                filter === 'watchlist'
                  ? 'selected'
                  : ''
              }
              onClick={() =>
                setFilter('watchlist')
              }
            >
              WATCHLIST
            </button>

            <button
              className={
                filter === 'watched'
                  ? 'selected'
                  : ''
              }
              onClick={() =>
                setFilter('watched')
              }
            >
              WATCHED
            </button>

          </div>
        )}

        {/* MOVIE / TV */}

        <div className="filter-row">

          <button
            className={
              kind === 'all'
                ? 'selected'
                : ''
            }
            onClick={() =>
              setKind('all')
            }
          >
            ALL
          </button>

          <button
            className={
              kind === 'movie'
                ? 'selected'
                : ''
            }
            onClick={() =>
              setKind('movie')
            }
          >
            <Film size={15} />
            MOVIES
          </button>

          <button
            className={
              kind === 'tv'
                ? 'selected'
                : ''
            }
            onClick={() =>
              setKind('tv')
            }
          >
            <Tv size={15} />
            TV
          </button>

        </div>

        <h2 className="library-heading">
          Library
        </h2>

        <div className="grid">

          {visible.map(t => (
            <Card
              key={t.id}
              t={t}
              st={st}
              isAdmin={isAdmin}
              onWatch={() =>
                toggle(
                  'watched',
                  t.id
                )
              }
              onList={() =>
                toggle(
                  'watchlist',
                  t.id
                )
              }
              onRewatch={() =>
                toggle(
                  'rewatch',
                  t.id
                )
              }
              onRemove={() =>
                removeTitle(t.id)
              }
              onReminder={() =>
                setShowReminder(t)
              }
              onSchedule={() =>
                setShowSchedule(t)
              }
            />
          ))}

          {!visible.length && (
            <div className="empty">
              Nothing here yet.
            </div>
          )}

        </div>

      </main>

      {/* RECOMMENDATION */}

      {showReco && rec && (
        <Modal
          title="Today's Reco"
          onClose={() =>
            setShowReco(false)
          }
        >
          <div className="reco">

            <img src={rec.poster} />

            <div>

              <h2>{rec.name}</h2>

              <p>
                {rec.year} ·{' '}
                {rec.kind === 'movie'
                  ? 'Movie'
                  : 'TV Show'}
              </p>

              <p>{rec.overview}</p>

              <button
                className="pink"
                onClick={() => {
                  toggle(
                    'watchlist',
                    rec.id
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
          onClose={() =>
            setShowProfile(false)
          }
        >
          <div className="profiles">

            {profiles.map(x => (
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
                      ? 'current'
                      : ''
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

                {x.id !== 'admin' && (
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
                  id: 'new',
                  name: '',
                  avatar: '🙂'
                });

                setShowProfile(false);
              }}
            >
              <Plus /> Add Profile
            </button>

          </div>
        </Modal>
      )}

      {/* PROFILE EDITOR */}

      {editing && (
        <ProfileEditor
          profile={
            editing.id === 'new'
              ? null
              : editing
          }
          onClose={() =>
            setEditing(null)
          }
          onSave={(n, a) =>
            editing.id === 'new'
              ? addProfile(n, a)
              : (
                  setProfiles(
                    profiles.map(x =>
                      x.id === editing.id
                        ? {
                            ...x,
                            name: n,
                            avatar: a
                          }
                        : x
                    )
                  ),
                  setEditing(null)
                )
          }
          onDelete={
            editing.id === 'new'
              ? undefined
              : () => {
                  setProfiles(
                    profiles.filter(
                      x =>
                        x.id !== editing.id
                    )
                  );

                  const ns = {
                    ...states
                  };

                  delete ns[editing.id];

                  setStates(ns);
                  setEditing(null);
                  setProfileId('admin');
                }
          }
        />
      )}

      {/* ADMIN ADD TITLE */}

      {showAdd && (
        <AddTitle
          library={library}
          onClose={() =>
            setShowAdd(false)
          }
          onAdd={t =>
            setLibrary([
              ...library,
              t
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
          onSave={(d, time) => {
            setReminders([
              ...reminders,
              {
                id: uid(),
                profileId,
                titleId:
                  showReminder.id,
                date: d,
                time
              }
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
            x => x.id !== 'admin'
          )}
          onClose={() =>
            setShowSchedule(null)
          }
          onSave={r => {
            setScheduled([
              ...scheduled,
              r
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
          onSave={t => {
            setHero(t);
            setShowHero(false);
          }}
        />
      )}

      <footer>

        <span>
          <Clock size={14} />
          {
            reminders.filter(
              r =>
                r.profileId ===
                profileId
            ).length
          } reminder(s)
        </span>

        {isAdmin && (
          <span>
            {scheduled.length}{' '}
            scheduled reco(s)
          </span>
        )}

        <button
          onClick={() =>
            alert(
              'Demo mode: connect your real auth/backend before production use.'
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
  return (
    <article className="card">

      <div className="poster-wrap">

        <img
          src={t.poster}
          onError={e => {
            e.currentTarget.src =
              'https://placehold.co/500x750/171717/ffffff?text=' +
              encodeURIComponent(
                t.name
              );
          }}
        />

        <span className="kind">
          {t.kind === 'movie'
            ? 'MOVIE'
            : 'TV'}
        </span>

        {isAdmin && (
          <button
            className="remove"
            onClick={onRemove}
          >
            <Trash2 size={16} />
          </button>
        )}

      </div>

      <div className="card-body">

        <h3>{t.name}</h3>

        <p>
          {t.year}
          {t.rating !== undefined && (
            <>
              {' · '}
              <Star size={13} />
              {t.rating.toFixed(1)}
            </>
          )}
        </p>

        {t.genres &&
          t.genres.length > 0 && (
            <p className="genres">
              {t.genres.join(' · ')}
            </p>
          )}

        {t.overview && (
          <p className="overview">
            {t.overview}
          </p>
        )}

        <div className="actions">

          <button
            className={
              st.watchlist.includes(
                t.id
              )
                ? 'on'
                : ''
            }
            onClick={onList}
          >
            + Watchlist
          </button>

          <button
            className={
              st.watched.includes(
                t.id
              )
                ? 'on'
                : ''
            }
            onClick={onWatch}
          >
            {st.watched.includes(
              t.id
            )
              ? '✓ Watched'
              : 'Mark watched'}
          </button>

        </div>

        <div className="small-actions">

          <button
            onClick={onRewatch}
          >
            ↻ Re-watch
          </button>

          <button
            onClick={onReminder}
          >
            <Bell size={14} />
            Remind me
          </button>

          {isAdmin && (
            <button
              onClick={onSchedule}
            >
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
  children
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overlay"
      onMouseDown={e => {
        if (
          e.currentTarget ===
          e.target
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
   ADD TITLE / TMDB
-------------------------------------------------- */

function AddTitle({
  library,
  onClose,
  onAdd
}: {
  library: Title[];
  onClose: () => void;
  onAdd: (t: Title) => void;
}) {
  const [q, setQ] =
    useState('');

  const [results, setResults] =
    useState<Title[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [year, setYear] =
    useState('');

  const [genre, setGenre] =
    useState('');

  const [rating, setRating] =
    useState('');

  const clear = () => {
    setQ('');
    setYear('');
    setGenre('');
    setRating('');
    setResults([]);
  };

  useEffect(() => {

    if (!q.trim()) {
      setResults([]);
      return;
    }

    const timer =
      setTimeout(async () => {

        setLoading(true);
        setError('');

        try {

          const data =
            await searchTMDB(q);

          setResults(data);

        } catch {

          setError(
            'Unable to search TMDB right now.'
          );

        } finally {

          setLoading(false);

        }

      }, 400);

    return () =>
      clearTimeout(timer);

  }, [q]);

  const filtered = results
    .filter(
      t =>
        !year ||
        String(t.year) === year
    )
    .filter(
      t =>
        !rating ||
        (t.rating || 0) >=
          Number(rating)
    );

  const resultYears = [
    ...new Set(
      results
        .map(t => t.year)
        .filter(Boolean)
    )
  ].sort((a, b) => b - a);

  return (
    <Modal
      title="Add Movie / TV Show"
      onClose={onClose}
    >

      <p className="muted">
        Search TMDB and add movies or
        TV shows to your Streamix library.
      </p>

      <div className="search wide">

        <Search size={18} />

        <input
          autoFocus
          value={q}
          onChange={e =>
            setQ(e.target.value)
          }
          placeholder="Search TMDB"
        />

      </div>

      <div className="library-filters">

        <select
          value={year}
          onChange={e =>
            setYear(e.target.value)
          }
        >
          <option value="">
            YEAR
          </option>

          {resultYears.map(y => (
            <option
              key={y}
              value={y}
            >
              {y}
            </option>
          ))}
        </select>

        <select
          value={genre}
          onChange={e =>
            setGenre(e.target.value)
          }
        >
          <option value="">
            GENRE
          </option>

          <option>
            Action
          </option>

          <option>
            Adventure
          </option>

          <option>
            Animation
          </option>

          <option>
            Comedy
          </option>

          <option>
            Crime
          </option>

          <option>
            Documentary
          </option>

          <option>
            Drama
          </option>

          <option>
            Fantasy
          </option>

          <option>
            Horror
          </option>

          <option>
            Mystery
          </option>

          <option>
            Romance
          </option>

          <option>
            Science Fiction
          </option>

          <option>
            Thriller
          </option>

        </select>

        <select
          value={rating}
          onChange={e =>
            setRating(e.target.value)
          }
        >
          <option value="">
            RATING
          </option>

          <option value="9">
            9+
          </option>

          <option value="8">
            8+
          </option>

          <option value="7">
            7+
          </option>

          <option value="6">
            6+
          </option>

          <option value="5">
            5+
          </option>

        </select>

        <button
          className="clear-filters"
          onClick={clear}
        >
          CLEAR FILTERS
        </button>

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

        {filtered
          .filter(
            t =>
              !library.some(
                l =>
                  l.id === t.id
              )
          )
          .map(t => (

            <div
              className="result"
              key={t.id}
            >

              <img
                src={t.poster}
              />

              <div>

                <b>{t.name}</b>

                <span>
                  {t.year} ·{' '}
                  {t.kind === 'movie'
                    ? 'Movie'
                    : 'TV Show'}
                </span>

                {t.rating !==
                  undefined && (
                  <span>
                    ★{' '}
                    {t.rating.toFixed(
                      1
                    )}
                  </span>
                )}

                {t.overview && (
                  <span className="result-overview">
                    {t.overview}
                  </span>
                )}

              </div>

              <button
                className="pink add"
                onClick={() => {

                  onAdd(t);

                  setResults(
                    results.filter(
                      x =>
                        x.id !== t.id
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
   PROFILE EDITOR
-------------------------------------------------- */

function ProfileEditor({
  profile,
  onClose,
  onSave,
  onDelete
}: {
  profile: Profile | null;
  onClose: () => void;
  onSave: (
    n: string,
    a: string
  ) => void;
  onDelete?: () => void;
}) {
  const [n, setN] =
    useState(profile?.name || '');

  const [a, setA] =
    useState(
      profile?.avatar || '🙂'
    );

  return (
    <Modal
      title={
        profile
          ? 'Edit Profile'
          : 'Add Profile'
      }
      onClose={onClose}
    >

      <label>
        Profile Name

        <input
          autoFocus
          value={n}
          onChange={e =>
            setN(e.target.value)
          }
        />
      </label>

      <label>
        Profile Photo

        <div className="emoji-grid">

          {[
            '🙂',
            '🌸',
            '🎬',
            '🍿',
            '⭐',
            '🐱',
            '🦋',
            '🔥'
          ].map(x => (

            <button
              className={
                a === x
                  ? 'picked'
                  : ''
              }
              onClick={() =>
                setA(x)
              }
              key={x}
            >
              {x}
            </button>

          ))}

        </div>
      </label>

      <button
        className="pink full"
        onClick={() =>
          onSave(n, a)
        }
      >
        Save Profile
      </button>

      {onDelete && (
        <button
          className="danger full"
          onClick={() =>
            confirm(
              'Delete this profile?'
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
   REMINDER
-------------------------------------------------- */

function ReminderModal({
  title,
  onClose,
  onSave
}: {
  title: Title;
  onClose: () => void;
  onSave: (
    d: string,
    t: string
  ) => void;
}) {
  const [d, setD] =
    useState('');

  const [t, setT] =
    useState('19:00');

  return (
    <Modal
      title="Remind Me"
      onClose={onClose}
    >

      <p>
        Set a reminder for{' '}
        <b>{title.name}</b>.
      </p>

      <label>
        Date

        <input
          type="date"
          value={d}
          onChange={e =>
            setD(e.target.value)
          }
        />
      </label>

      <label>
        Time

        <input
          type="time"
          value={t}
          onChange={e =>
            setT(e.target.value)
          }
        />
      </label>

      <button
        className="pink full"
        disabled={!d}
        onClick={() =>
          onSave(d, t)
        }
      >
        Save Reminder
      </button>

    </Modal>
  );
}

/* --------------------------------------------------
   SCHEDULE
-------------------------------------------------- */

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
    r: Scheduled
  ) => void;
}) {
  const [pid, setPid] =
    useState(
      profiles[0]?.id || ''
    );

  const [d, setD] =
    useState('');

  const [t, setT] =
    useState('19:00');

  const [m, setM] =
    useState(
      'How about this one?'
    );

  return (
    <Modal
      title="Schedule Personal Recommendation"
      onClose={onClose}
    >

      <label>
        Profile

        <select
          value={pid}
          onChange={e =>
            setPid(e.target.value)
          }
        >
          {profiles.map(p => (
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
          value={d}
          onChange={e =>
            setD(e.target.value)
          }
        />
      </label>

      <label>
        Time

        <input
          type="time"
          value={t}
          onChange={e =>
            setT(e.target.value)
          }
        />
      </label>

      <label>
        Message

        <textarea
          value={m}
          onChange={e =>
            setM(e.target.value)
          }
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
            message: m
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
  onSave
}: {
  hero: Title;
  library: Title[];
  onClose: () => void;
  onSave: (t: Title) => void;
}) {
  const [id, setId] =
    useState(hero.id);

  return (
    <Modal
      title="Edit Hero"
      onClose={onClose}
    >

      <label>
        Hero title

        <select
          value={id}
          onChange={e =>
            setId(e.target.value)
          }
        >
          {library.map(t => (
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
            library.find(
              x => x.id === id
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
  document.getElementById('root')!
).render(<App />);
