# Complete `main.tsx`

```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
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
} from 'lucide-react';
import './styles.css';

/* =========================================================
   TYPES
========================================================= */

type Kind = 'movie' | 'tv';

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
  | 'name-asc'
  | 'name-desc'
  | 'year-desc'
  | 'year-asc'
  | 'year-filter';

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
    id: 'admin',
    name: 'Admin',
    avatar: '👑'
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

const uid = () =>
  Math.random().toString(36).slice(2) +
  Date.now().toString(36);

const emptyState = (): State => ({
  watched: [],
  watchlist: [],
  rewatch: []
});

/* =========================================================
   SAFE LOCAL STORAGE
========================================================= */

function readStored<T>(
  key: string,
  fallback: T
): T {
  try {
    const stored = localStorage.getItem(key);

    if (!stored) {
      return fallback;
    }

    const parsed = JSON.parse(stored);

    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function useStored<T>(
  key: string,
  fallback: T
) {
  const [value, setValue] = useState<T>(() =>
    readStored(key, fallback)
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );
    } catch {
      // Ignore storage errors so they cannot crash the app.
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/* =========================================================
   TMDB SERVICE
========================================================= */

async function searchTMDB(
  query: string
): Promise<Title[]> {
  if (!query.trim()) {
    return [];
  }

  const response = await fetch(
    `/api/tmdb/search?query=${encodeURIComponent(
      query.trim()
    )}&type=multi`
  );

  if (!response.ok) {
    throw new Error(
      `TMDB search failed: ${response.status}`
    );
  }

  const data = await response.json();

  if (!data || !Array.isArray(data.results)) {
    return [];
  }

  return data.results
    .filter(
      (item: any) =>
        item &&
        (item.media_type === 'movie' ||
          item.media_type === 'tv')
    )
    .map((item: any): Title => {
      const kind: Kind =
        item.media_type === 'tv'
          ? 'tv'
          : 'movie';

      const date =
        kind === 'movie'
          ? item.release_date
          : item.first_air_date;

      const name =
        kind === 'movie'
          ? item.title
          : item.name;

      return {
        id: `tmdb-${kind}-${item.id}`,
        name: name || 'Untitled',
        kind,
        year: date
          ? Number(String(date).slice(0, 4))
          : 0,
        poster: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : `https://placehold.co/500x750/171717/ffffff?text=${encodeURIComponent(
              name || 'No Poster'
            )}`,
        backdrop: item.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
          : '',
        overview: item.overview || '',
        addedAt:
          new Date().toISOString()
      };
    });
}

/* =========================================================
   APP
========================================================= */

function App() {
  /* -------------------------------------------------------
     STORED DATA
  ------------------------------------------------------- */

  const [library, setLibrary] =
    useStored<Title[]>(
      'sx-library',
      []
    );

  const [profiles, setProfiles] =
    useStored<Profile[]>(
      'sx-profiles',
      initialProfiles
    );

  const [states, setStates] =
    useStored<Record<string, State>>(
      'sx-states',
      initialState
    );

  const [reminders, setReminders] =
    useStored<Reminder[]>(
      'sx-reminders',
      []
    );

  const [scheduled, setScheduled] =
    useStored<Scheduled[]>(
      'sx-scheduled',
      []
    );

  const [heroSettings, setHeroSettings] =
    useStored<HeroSettings>(
      'sx-hero-settings',
      initialHero
    );

  /* -------------------------------------------------------
     UI STATE
  ------------------------------------------------------- */

  const [profileId, setProfileId] =
    useState('admin');

  const [tab, setTab] =
    useState<'library' | 'rewatch'>(
      'library'
    );

  const [filter, setFilter] =
    useState<
      'all' | 'watchlist' | 'watched'
    >('all');

  const [kind, setKind] =
    useState<'all' | Kind>('all');

  const [sort, setSort] =
    useState<SortOption>(
      'name-asc'
    );

  const [filterYear, setFilterYear] =
    useState('');

  const [showFilter, setShowFilter] =
    useState(false);

  const [q, setQ] = useState('');

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

  const filterRef =
    useRef<HTMLDivElement | null>(null);

  /* -------------------------------------------------------
     CLOSE FILTER WHEN CLICKING OUTSIDE
  ------------------------------------------------------- */

  useEffect(() => {
    const handlePointerDown = (
      event: PointerEvent
    ) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(
          event.target as Node
        )
      ) {
        setShowFilter(false);
      }
    };

    document.addEventListener(
      'pointerdown',
      handlePointerDown
    );

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown
      );
    };
  }, []);

  /* -------------------------------------------------------
     SAFETY: MAKE SURE ADMIN ALWAYS EXISTS
  ------------------------------------------------------- */

  useEffect(() => {
    const adminExists = profiles.some(
      profile => profile.id === 'admin'
    );

    if (!adminExists) {
      setProfiles([
        {
          id: 'admin',
          name: 'Admin',
          avatar: '👑'
        },
        ...profiles
      ]);
    }

    if (!states.admin) {
      setStates({
        ...states,
        admin: emptyState()
      });
    }

    // This effect intentionally runs once on startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------------------------------------
     CURRENT PROFILE
  ------------------------------------------------------- */

  const isAdmin =
    profileId === 'admin';

  const profile =
    profiles.find(
      item => item.id === profileId
    ) || profiles[0];

  const currentProfileId =
    profile?.id || 'admin';

  const state =
    states[currentProfileId] ||
    emptyState();

  /* -------------------------------------------------------
     HERO
  ------------------------------------------------------- */

  const hero =
    heroSettings.titleId
      ? library.find(
          title =>
            title.id ===
            heroSettings.titleId
        ) || null
      : null;

  /* -------------------------------------------------------
     TODAY'S RECOMMENDATION
  ------------------------------------------------------- */

  const recommendation = useMemo(() => {
    const watchlistTitles =
      library.filter(title => {
        return (
          state.watchlist.includes(
            title.id
          ) &&
          !state.watched.includes(
            title.id
          )
        );
      });

    return (
      watchlistTitles[0] || null
    );
  }, [library, state]);

  useEffect(() => {
    if (
      !currentProfileId ||
      !recommendation
    ) {
      return;
    }

    const key =
      `sx-reco-seen-${currentProfileId}`;

    try {
      const alreadySeen =
        localStorage.getItem(key);

      if (!alreadySeen) {
        setShowReco(true);
      }
    } catch {
      setShowReco(true);
    }
  }, [
    currentProfileId,
    recommendation
  ]);

  const closeRecommendation = () => {
    try {
      localStorage.setItem(
        `sx-reco-seen-${currentProfileId}`,
        'true'
      );
    } catch {
      // Ignore storage errors.
    }

    setShowReco(false);
  };

  /* -------------------------------------------------------
     VISIBLE LIBRARY
  ------------------------------------------------------- */

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
        .filter(
          title =>
            kind === 'all' ||
            title.kind === kind
        )
        .filter(title => {
          if (sort !== 'year-filter') {
            return true;
          }

          if (!filterYear) {
            return true;
          }

          return (
            title.year ===
            Number(filterYear)
          );
        })
        .filter(title => {
          if (tab === 'rewatch') {
            return state.rewatch.includes(
              title.id
            );
          }

          if (filter === 'all') {
            return true;
          }

          if (filter === 'watched') {
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
          case 'name-desc':
            return b.name.localeCompare(
              a.name
            );

          case 'year-desc':
            return b.year - a.year;

          case 'year-asc':
            return a.year - b.year;

          case 'year-filter':
          case 'name-asc':
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
    filterYear,
    state
  ]);

  /* -------------------------------------------------------
     STATE ACTIONS
  ------------------------------------------------------- */

  const updateState = (
    fn: (current: State) => State
  ) => {
    const current =
      states[currentProfileId] ||
      emptyState();

    setStates({
      ...states,
      [currentProfileId]:
        fn(current)
    });
  };

  const toggle = (
    array: keyof State,
    titleId: string
  ) => {
    updateState(current => {
      const exists =
        current[array].includes(
          titleId
        );

      return {
        ...current,
        [array]: exists
          ? current[array].filter(
              id => id !== titleId
            )
          : [
              ...current[array],
              titleId
            ]
      };
    });
  };

  /* -------------------------------------------------------
     FILTER ACTIONS
  ------------------------------------------------------- */

  const selectSort = (
    option: Exclude<
      SortOption,
      'year-filter'
    >
  ) => {
    setSort(option);
    setFilterYear('');
    setShowFilter(false);
  };

  const updateYearFilter = (
    value: string
  ) => {
    const numericValue =
      value.replace(/\D/g, '');

    setFilterYear(
      numericValue.slice(0, 4)
    );

    setSort('year-filter');
  };

  const clearYearFilter = () => {
    setFilterYear('');
    setSort('name-asc');
  };

  /* -------------------------------------------------------
     ADD TITLE
  ------------------------------------------------------- */

  const addTitle = (title: Title) => {
    const alreadyExists =
      library.some(
        item => item.id === title.id
      );

    if (alreadyExists) {
      return;
    }

    setLibrary([
      ...library,
      title
    ]);

    if (
      library.length === 0 &&
      !heroSettings.titleId
    ) {
      setHeroSettings({
        ...heroSettings,
        titleId: title.id
      });
    }
  };

  /* -------------------------------------------------------
     REMOVE TITLE
  ------------------------------------------------------- */

  const removeTitle = (
    titleId: string
  ) => {
    setLibrary(
      library.filter(
        title =>
          title.id !== titleId
      )
    );

    const nextStates: Record<
      string,
      State
    > = {};

    Object.entries(states).forEach(
      ([profileKey, profileState]) => {
        nextStates[profileKey] = {
          watched:
            profileState.watched.filter(
              savedTitleId =>
                savedTitleId !==
                titleId
            ),

          watchlist:
            profileState.watchlist.filter(
              savedTitleId =>
                savedTitleId !==
                titleId
            ),

          rewatch:
            profileState.rewatch.filter(
              savedTitleId =>
                savedTitleId !==
                titleId
            )
        };
      }
    );

    setStates(nextStates);

    setReminders(
      reminders.filter(
        reminder =>
          reminder.titleId !==
          titleId
      )
    );

    setScheduled(
      scheduled.filter(
        item =>
          item.titleId !==
          titleId
      )
    );

    if (
      heroSettings.titleId ===
      titleId
    ) {
      setHeroSettings({
        ...heroSettings,
        titleId: null
      });
    }
  };

  /* -------------------------------------------------------
     PROFILE MANAGEMENT
  ------------------------------------------------------- */

  const addProfile = (
    name: string,
    avatar: string
  ) => {
    const newProfile: Profile = {
      id: uid(),
      name:
        name.trim() ||
        'New Profile',
      avatar:
        avatar || '🙂'
    };

    setProfiles([
      ...profiles,
      newProfile
    ]);

    setStates({
      ...states,
      [newProfile.id]:
        emptyState()
    });

    setEditing(null);
  };

  const moveProfile = (
    index: number,
    direction: 'up' | 'down'
  ) => {
    if (
      direction === 'up' &&
      index === 0
    ) {
      return;
    }

    if (
      direction === 'down' &&
      index ===
        profiles.length - 1
    ) {
      return;
    }

    const next = [
      ...profiles
    ];

    const target =
      direction === 'up'
        ? index - 1
        : index + 1;

    [
      next[index],
      next[target]
    ] = [
      next[target],
      next[index]
    ];

    setProfiles(next);
  };

  const deleteProfile = (
    profileToDelete: Profile
  ) => {
    if (
      profileToDelete.id ===
      'admin'
    ) {
      return;
    }

    const nextProfiles =
      profiles.filter(
        item =>
          item.id !==
          profileToDelete.id
      );

    const nextStates = {
      ...states
    };

    delete nextStates[
      profileToDelete.id
    ];

    setProfiles(nextProfiles);
    setStates(nextStates);

    setEditing(null);

    if (
      profileId ===
      profileToDelete.id
    ) {
      setProfileId('admin');
    }
  };

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  return (
    <div className="app">

      {/* ===================================================
          HEADER
      =================================================== */}

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
              {profile?.avatar ||
                '👤'}
            </span>

            {profile?.name ||
              'Profile'}

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
              ADMIN
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
                <Plus size={17} />
                Add title
              </button>

              <button
                onClick={() => {
                  setShowHero(true);
                  setMenu(false);
                }}
              >
                <Settings
                  size={17}
                />
                Edit hero
              </button>

            </div>
          )}

        </div>

      </header>

      {/* ===================================================
          HERO
      =================================================== */}

      <section
        className="hero"
        style={{
          backgroundImage:
            hero?.backdrop
              ? `linear-gradient(
                  90deg,
                  rgba(0,0,0,.92),
                  rgba(0,0,0,.15)
                ),
                url("${hero.backdrop}")`
              : 'none',

          backgroundPosition:
            `${heroSettings.positionX}% ${heroSettings.positionY}%`
        }}
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

      {/* ===================================================
          MAIN
      =================================================== */}

      <main>

        {/* PRIMARY NAVIGATION */}

        <div className="switch">

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

          {!isAdmin && (
            <button
              className={
                tab === 'rewatch'
                  ? 'active rewatch-tab'
                  : 'rewatch-tab'
              }
              onClick={() =>
                setTab('rewatch')
              }
            >
              ↻ {profile?.name}'s
              Re-watch
            </button>
          )}

        </div>

        {/* LIBRARY CONTROLS */}

        {tab === 'library' && (
          <>
            <div className="toolbar">

              <div className="filters">

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
                  All
                </button>

                <button
                  className={
                    filter ===
                    'watchlist'
                      ? 'selected'
                      : ''
                  }
                  onClick={() =>
                    setFilter(
                      'watchlist'
                    )
                  }
                >
                  Watchlist
                </button>

                <button
                  className={
                    filter ===
                    'watched'
                      ? 'selected'
                      : ''
                  }
                  onClick={() =>
                    setFilter(
                      'watched'
                    )
                  }
                >
                  Watched
                </button>

              </div>

              <div className="search">

                <Search size={18} />

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

            <div className="format">

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
                All
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
                Movies
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

              {/* =========================================
                  FILTER MENU
              ========================================= */}

              <div
                className="filter-wrapper"
                ref={filterRef}
              >

                <button
                  type="button"
                  className={
                    sort ===
                      'year-filter' &&
                    filterYear
                      ? 'filter-button active'
                      : 'filter-button'
                  }
                  onClick={() =>
                    setShowFilter(
                      current =>
                        !current
                    )
                  }
                  aria-expanded={
                    showFilter
                  }
                  aria-haspopup="menu"
                >
                  Filter

                  <ChevronDown
                    size={16}
                    className={
                      showFilter
                        ? 'filter-chevron open'
                        : 'filter-chevron'
                    }
                  />
                </button>

                {showFilter && (
                  <div
                    className="filter-menu"
                    role="menu"
                  >

                    <button
                      type="button"
                      className={
                        sort ===
                        'name-asc'
                          ? 'filter-option selected'
                          : 'filter-option'
                      }
                      onClick={() =>
                        selectSort(
                          'name-asc'
                        )
                      }
                    >
                      <span>
                        Name A–Z
                      </span>

                      {sort ===
                        'name-asc' && (
                        <Check
                          size={15}
                        />
                      )}
                    </button>

                    <button
                      type="button"
                      className={
                        sort ===
                        'name-desc'
                          ? 'filter-option selected'
                          : 'filter-option'
                      }
                      onClick={() =>
                        selectSort(
                          'name-desc'
                        )
                      }
                    >
                      <span>
                        Name Z–A
                      </span>

                      {sort ===
                        'name-desc' && (
                        <Check
                          size={15}
                        />
                      )}
                    </button>

                    <button
                      type="button"
                      className={
                        sort ===
                        'year-desc'
                          ? 'filter-option selected'
                          : 'filter-option'
                      }
                      onClick={() =>
                        selectSort(
                          'year-desc'
                        )
                      }
                    >
                      <span>
                        Newest release
                      </span>

                      {sort ===
                        'year-desc' && (
                        <Check
                          size={15}
                        />
                      )}
                    </button>

                    <button
                      type="button"
                      className={
                        sort ===
                        'year-asc'
                          ? 'filter-option selected'
                          : 'filter-option'
                      }
                      onClick={() =>
                        selectSort(
                          'year-asc'
                        )
                      }
                    >
                      <span>
                        Oldest release
                      </span>

                      {sort ===
                        'year-asc' && (
                        <Check
                          size={15}
                        />
                      )}
                    </button>

                    <div className="filter-year-section">

                      <span>
                        Filter by year
                      </span>

                      <div className="filter-year-row">

                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={4}
                          placeholder="YYYY"
                          value={
                            filterYear
                          }
                          onChange={event =>
                            updateYearFilter(
                              event
                                .target
                                .value
                            )
                          }
                          aria-label="Filter by year"
                        />

                        {filterYear && (
                          <button
                            type="button"
                            className="clear-year"
                            onClick={
                              clearYearFilter
                            }
                            aria-label="Clear year"
                          >
                            <X
                              size={15}
                            />
                          </button>
                        )}

                      </div>

                    </div>

                  </div>
                )}

              </div>

            </div>
          </>
        )}

        {/* LIBRARY GRID */}

        <div className="grid">

          {visible.map(title => (
            <Card
              key={title.id}
              t={title}
              st={state}
              isAdmin={isAdmin}
              onWatch={() =>
                toggle(
                  'watched',
                  title.id
                )
              }
              onList={() =>
                toggle(
                  'watchlist',
                  title.id
                )
              }
              onRewatch={() =>
                toggle(
                  'rewatch',
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
                ? 'Your library is empty.'
                : 'Nothing here yet.'}
            </div>
          )}

        </div>

      </main>

      {/* ===================================================
          TODAY'S RECOMMENDATION
      =================================================== */}

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
                  {recommendation.year} ·{' '}
                  {recommendation.kind ===
                  'movie'
                    ? 'Movie'
                    : 'TV Show'}
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

      {/* ===================================================
          PROFILES
      =================================================== */}

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
                      currentProfileId
                        ? 'current'
                        : ''
                    }
                  >

                    <span className="avatar">
                      {item.avatar}
                    </span>

                    <span>
                      {item.name}
                    </span>

                    {item.id ===
                      currentProfileId && (
                      <Check
                        size={18}
                      />
                    )}

                  </button>

                  {isAdmin &&
                    item.id !==
                      'admin' && (
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
                        aria-label={`Edit ${item.name}`}
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
                              'up'
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
                              'down'
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
                    id: 'new',
                    name: '',
                    avatar: '🙂'
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

      {/* ===================================================
          PROFILE EDITOR
      =================================================== */}

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
          onSave={(name, avatar) => {
            if (
              editing.id === 'new'
            ) {
              addProfile(
                name,
                avatar
              );
              return;
            }

            setProfiles(
              profiles.map(
                item =>
                  item.id ===
                  editing.id
                    ? {
                        ...item,
                        name:
                          name.trim() ||
                          item.name,
                        avatar:
                          avatar ||
                          item.avatar
                      }
                    : item
              )
            );

            setEditing(null);
          }}
          onDelete={
            editing.id === 'new'
              ? undefined
              : () =>
                  deleteProfile(
                    editing
                  )
          }
        />
      )}

      {/* ===================================================
          ADD TITLE
      =================================================== */}

      {showAdd && (
        <AddTitle
          library={library}
          onClose={() =>
            setShowAdd(false)
          }
          onAdd={addTitle}
        />
      )}

      {/* ===================================================
          REMINDER
      =================================================== */}

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
                profileId:
                  currentProfileId,
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

      {/* ===================================================
          SCHEDULE RECOMMENDATION
      =================================================== */}

      {showSchedule &&
        isAdmin && (
          <ScheduleModal
            title={showSchedule}
            profiles={profiles.filter(
              item =>
                item.id !==
                'admin'
            )}
            onClose={() =>
              setShowSchedule(null)
            }
            onSave={item => {
              setScheduled([
                ...scheduled,
                item
              ]);

              setShowSchedule(null);
            }}
          />
        )}

      {/* ===================================================
          HERO EDITOR
      =================================================== */}

      {showHero &&
        isAdmin && (
          <HeroModal
            hero={hero}
            library={library}
            settings={
              heroSettings
            }
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

      {/* ===================================================
          FOOTER
      =================================================== */}

      <footer>

        <span>
          <Clock size={14} />

          {
            reminders.filter(
              reminder =>
                reminder.profileId ===
                currentProfileId
            ).length
          }

          reminder(s)
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
              'Sign out will be connected to your real authentication system.'
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
  const watched =
    st.watched.includes(t.id);

  const watchlisted =
    st.watchlist.includes(t.id);

  const rewatches =
    st.rewatch.includes(t.id);

  return (
    <article className="card">

      <div className="poster-wrap">

        <img
          src={t.poster}
          alt={t.name}
          onError={event => {
            const image =
              event.currentTarget;

            if (
              image.dataset.fallback
            ) {
              return;
            }

            image.dataset.fallback =
              'true';

            image.src =
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
            title="Remove title"
            aria-label={`Remove ${t.name}`}
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
              watchlisted
                ? 'on'
                : ''
            }
            onClick={onList}
          >
            + Watchlist
          </button>

          <button
            className={
              watched
                ? 'on'
                : ''
            }
            onClick={onWatch}
          >
            {watched
              ? '✓ Watched'
              : 'Mark watched'}
          </button>

        </div>

        <div className="small-actions">

          {!isAdmin && (
            <button
              className={
                rewatches
                  ? 'rewatch-action on'
                  : 'rewatch-action'
              }
              onClick={onRewatch}
            >
              ↻ Re-watch
            </button>
          )}

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
      profile?.name || ''
    );

  const [avatar, setAvatar] =
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

          {[
            '🙂',
            '🌸',
            '🎬',
            '🍿',
            '⭐',
            '🐱',
            '🦋',
            '🔥'
          ].map(item => (
            <button
              type="button"
              className={
                avatar === item
                  ? 'picked'
                  : ''
              }
              onClick={() =>
                setAvatar(item)
              }
              key={item}
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
          onChange={() => {
            /*
             * Upload functionality can be
             * connected later.
             */
          }}
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
                'Delete this profile?'
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
    useState('');

  const [results, setResults] =
    useState<Title[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    const trimmed =
      query.trim();

    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setError('');
      return;
    }

    let cancelled = false;

    const timer =
      window.setTimeout(
        async () => {
          setLoading(true);
          setError('');

          try {
            const data =
              await searchTMDB(
                trimmed
              );

            if (!cancelled) {
              setResults(data);
            }
          } catch {
            if (!cancelled) {
              setResults([]);

              setError(
                'Unable to search TMDB right now.'
              );
            }
          } finally {
            if (!cancelled) {
              setLoading(false);
            }
          }
        },
        400
      );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const available =
    results.filter(
      title =>
        !library.some(
          item =>
            item.id === title.id
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

      {!loading &&
        !error &&
        query.trim() &&
        available.length === 0 && (
          <p className="muted">
            No results found.
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
              onError={event => {
                event.currentTarget.src =
                  'https://placehold.co/500x750/171717/ffffff?text=No+Poster';
              }}
            />

            <div>

              <b>
                {title.name}
              </b>

              <span>
                {title.year} ·{' '}
                {title.kind ===
                'movie'
                  ? 'Movie'
                  : 'TV Show'}
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
    useState('');

  const [time, setTime] =
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
      profiles[0]?.id || ''
    );

  const [date, setDate] =
    useState('');

  const [time, setTime] =
    useState('19:00');

  const [message, setMessage] =
    useState(
      'How about this one?'
    );

  return (
    <Modal
      title="Schedule Personal Recommendation"
      onClose={onClose}
    >

      {profiles.length === 0 ? (
        <>
          <p className="muted">
            Add a profile first
            before scheduling a
            recommendation.
          </p>
        </>
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
              {profiles.map(profile => (
                <option
                  value={profile.id}
                  key={profile.id}
                >
                  {profile.name}
                </option>
              ))}
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
    useState<string>(
      settings.titleId ||
        library[0]?.id ||
        ''
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
        Choose which title
        appears in the featured
        hero.
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
                  `url("${selectedTitle.backdrop}")`,
                backgroundPosition:
                  `${positionX}% ${positionY}%`
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
                    event.target.value
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
                    event.target.value
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
  document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Streamix could not start: #root element was not found.'
  );
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```
