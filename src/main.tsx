import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
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

type Kind = 'movie' | 'tv';

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

type HeroSettings = {
  title: Title;
  width: number;
  height: number;
  positionX: number;
  positionY: number;
};

/* --------------------------------------------------
   INITIAL DATA
-------------------------------------------------- */

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

/* --------------------------------------------------
   HELPERS
-------------------------------------------------- */

const uid = () =>
  Math.random().toString(36).slice(2) +
  Date.now().toString(36);

function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      return (
        JSON.parse(
          localStorage.getItem(key) || 'null'
        ) ?? fallback
      );
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  }, [key, value]);

  return [value, setValue] as const;
}

/* --------------------------------------------------
   TMDB SERVICE
-------------------------------------------------- */

async function searchTMDB(
  query: string
): Promise<Title[]> {
  if (!query.trim()) return [];

  const response = await fetch(
    `/api/tmdb/search?query=${encodeURIComponent(
      query
    )}&type=multi`
  );

  if (!response.ok) {
    throw new Error('TMDB search failed');
  }

  const data = await response.json();

  return (data.results || [])
    .filter(
      (item: any) =>
        item.media_type === 'movie' ||
        item.media_type === 'tv'
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

      return {
        id: `tmdb-${kind}-${item.id}`,

        name:
          kind === 'movie'
            ? item.title
            : item.name,

        kind,

        year: date
          ? Number(date.slice(0, 4))
          : 0,

        poster: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : 'https://placehold.co/500x750/171717/ffffff?text=No+Poster',

        backdrop: item.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
          : '',

        overview: item.overview || ''
      };
    });
}

/* --------------------------------------------------
   APP
-------------------------------------------------- */

function App() {
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

  const [hero, setHero] =
    useStored<HeroSettings | null>(
      'sx-hero',
      null
    );

  const [
    dismissedRecoProfiles,
    setDismissedRecoProfiles
  ] = useStored<Record<string, boolean>>(
    'sx-reco-dismissed',
    {}
  );

  const [profileId, setProfileId] =
    useState('admin');

  const [filter, setFilter] =
    useState<
      'all' | 'watchlist' | 'watched'
    >('all');

  const [kind, setKind] =
    useState<'all' | Kind>('all');

  const [sort, setSort] =
    useState<
      'name-asc' | 'name-desc' | 'date-new' | 'date-old'
    >('name-asc');

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

  const isAdmin =
    profileId === 'admin';

  const p =
    profiles.find(
      x => x.id === profileId
    ) || profiles[0];

  const st =
    states[profileId] || {
      watched: [],
      watchlist: [],
      rewatch: []
    };

  /* --------------------------------------------------
     TODAY'S RECOMMENDATION
  -------------------------------------------------- */

  const rec = library.find(
    title =>
      st.watchlist.includes(title.id) &&
      !st.watched.includes(title.id)
  );

  useEffect(() => {
    if (
      !isAdmin &&
      rec &&
      !dismissedRecoProfiles[profileId]
    ) {
      setShowReco(true);
    } else {
      setShowReco(false);
    }
  }, [
    profileId,
    isAdmin,
    rec?.id,
    dismissedRecoProfiles
  ]);

  const dismissReco = () => {
    setShowReco(false);

    setDismissedRecoProfiles({
      ...dismissedRecoProfiles,
      [profileId]: true
    });
  };

  /* --------------------------------------------------
     VISIBLE LIBRARY
  -------------------------------------------------- */

  const visible = useMemo(() => {
    let results = library
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
      .filter(t => {
        if (filter === 'all') {
          return true;
        }

        if (filter === 'watched') {
          return st.watched.includes(
            t.id
          );
        }

        return st.watchlist.includes(
          t.id
        );
      });

    results.sort((a, b) => {
      if (sort === 'name-asc') {
        return a.name.localeCompare(
          b.name
        );
      }

      if (sort === 'name-desc') {
        return b.name.localeCompare(
          a.name
        );
      }

      if (sort === 'date-new') {
        return b.year - a.year;
      }

      return a.year - b.year;
    });

    return results;
  }, [
    library,
    q,
    kind,
    filter,
    sort,
    st
  ]);

  /* --------------------------------------------------
     STATE
  -------------------------------------------------- */

  const updateState = (
    fn: (s: State) => State
  ) => {
    setStates({
      ...states,
      [profileId]: fn(st)
    });
  };

  const toggle = (
    arr: keyof State,
    id: string
  ) => {
    updateState(s => ({
      ...s,
      [arr]: s[arr].includes(id)
        ? s[arr].filter(
            x => x !== id
          )
        : [...s[arr], id]
    }));
  };

  /* --------------------------------------------------
     REMOVE TITLE
  -------------------------------------------------- */

  const removeTitle = (
    id: string
  ) => {
    setLibrary(
      library.filter(
        t => t.id !== id
      )
    );

    const nextStates = {
      ...states
    };

    Object.keys(nextStates).forEach(
      key => {
        nextStates[key] = {
          watched:
            nextStates[key].watched.filter(
              x => x !== id
            ),

          watchlist:
            nextStates[key].watchlist.filter(
              x => x !== id
            ),

          rewatch:
            nextStates[key].rewatch.filter(
              x => x !== id
            )
        };
      }
    );

    setStates(nextStates);

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

    if (
      hero?.title.id === id
    ) {
      setHero(null);
    }
  };

  /* --------------------------------------------------
     ADD PROFILE
  -------------------------------------------------- */

  const addProfile = (
    name: string,
    avatar: string
  ) => {
    const newProfile: Profile = {
      id: uid(),
      name:
        name || 'New Profile',
      avatar:
        avatar || '🙂'
    };

    setProfiles([
      ...profiles,
      newProfile
    ]);

    setStates({
      ...states,
      [newProfile.id]: {
        watched: [],
        watchlist: [],
        rewatch: []
      }
    });

    setEditing(null);
  };

  /* --------------------------------------------------
     PROFILE REORDER
  -------------------------------------------------- */

  const moveProfile = (
    index: number,
    direction: 'up' | 'down'
  ) => {
    const next = [...profiles];

    const newIndex =
      direction === 'up'
        ? index - 1
        : index + 1;

    if (
      newIndex < 0 ||
      newIndex >= next.length
    ) {
      return;
    }

    const temp =
      next[index];

    next[index] =
      next[newIndex];

    next[newIndex] =
      temp;

    setProfiles(next);
  };

  /* --------------------------------------------------
     RENDER
  -------------------------------------------------- */

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
              {p.avatar}
            </span>

            {p.name}

            <ChevronDown
              size={16}
            />
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
        style={{
          backgroundImage:
            hero?.title.backdrop
              ? `linear-gradient(90deg,rgba(0,0,0,.92),rgba(0,0,0,.15)),url(${hero.title.backdrop})`
              : 'none',

          backgroundSize: hero
            ? `${hero.width}% ${hero.height}%`
            : 'cover',

          backgroundPosition: hero
            ? `${hero.positionX}% ${hero.positionY}%`
            : 'center'
        }}
      >

        <div className="hero-content">

          {hero ? (
            <>
              <div className="eyebrow">
                FEATURED
              </div>

              <h1>
                {hero.title.name}
              </h1>

              <p>
                {hero.title.year}
                {' · '}
                {hero.title.kind ===
                'movie'
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
              <div className="eyebrow">
                FEATURED
              </div>

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

        {/* LIBRARY FILTERS */}

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
                filter === 'watched'
                  ? 'selected'
                  : ''
              }
              onClick={() =>
                setFilter('watched')
              }
            >
              Watched
            </button>

          </div>

          <div className="search">

            <Search size={18} />

            <input
              value={q}
              onChange={e =>
                setQ(e.target.value)
              }
              placeholder="Search library"
            />

          </div>

        </div>

        {/* FORMAT + SORT */}

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

          <select
            value={sort}
            onChange={e =>
              setSort(
                e.target.value as
                  | 'name-asc'
                  | 'name-desc'
                  | 'date-new'
                  | 'date-old'
              )
            }
          >
            <option value="name-asc">
              A–Z
            </option>

            <option value="name-desc">
              Z–A
            </option>

            <option value="date-new">
              Newest
            </option>

            <option value="date-old">
              Oldest
            </option>
          </select>

        </div>

        {/* RE-WATCH */}

        {!isAdmin && (
          <div
            style={{
              marginTop: '18px',
              marginBottom: '8px'
            }}
          >
            <button
              className="pink"
              onClick={() => {
                const current =
                  st.rewatch;

                if (current.length) {
                  setFilter('all');
                }
              }}
            >
              ↻ {p.name}'s Re-watch
            </button>
          </div>
        )}

        {/* GRID */}

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

      {/* TODAY'S RECO */}

      {showReco &&
        rec &&
        !isAdmin && (
          <Modal
            title="Today's Reco"
            onClose={
              dismissReco
            }
          >

            <div
              className="reco"
              style={{
                padding:
                  '12px 4px 8px'
              }}
            >

              <img
                src={rec.poster}
                alt={rec.name}
              />

              <div>

                <div
                  style={{
                    display:
                      'inline-block',
                    padding:
                      '6px 10px',
                    borderRadius:
                      '999px',
                    background:
                      'rgba(255,255,255,.08)',
                    marginBottom:
                      '10px'
                  }}
                >
                  <strong>
                    {rec.name}
                  </strong>
                </div>

                <p>
                  {rec.year}
                  {' · '}
                  {rec.kind ===
                  'movie'
                    ? 'Movie'
                    : 'TV Show'}
                </p>

                <p>
                  {rec.overview}
                </p>

                <button
                  className="pink"
                  onClick={
                    dismissReco
                  }
                >
                  Got it
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

            {profiles.map(
              (profile, index) => (
                <div
                  className="profile-row"
                  key={profile.id}
                >

                  <button
                    onClick={() => {
                      setProfileId(
                        profile.id
                      );

                      setShowProfile(
                        false
                      );
                    }}
                    className={
                      profile.id ===
                      profileId
                        ? 'current'
                        : ''
                    }
                  >

                    <span className="avatar">
                      {profile.avatar}
                    </span>

                    <span>
                      {profile.name}
                    </span>

                    {profile.id ===
                      profileId && (
                      <Check
                        size={18}
                      />
                    )}

                  </button>

                  {isAdmin &&
                    profile.id !==
                      'admin' && (
                      <div
                        style={{
                          display:
                            'flex',
                          gap:
                            '4px'
                        }}
                      >

                        <button
                          className="icon"
                          disabled={
                            index === 1
                          }
                          onClick={() =>
                            moveProfile(
                              index,
                              'up'
                            )
                          }
                          title="Move up"
                        >
                          <ChevronUp
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
                          title="Move down"
                        >
                          <ChevronDown
                            size={16}
                          />
                        </button>

                        <button
                          className="icon"
                          onClick={() => {
                            setEditing(
                              profile
                            );
                            setShowProfile(
                              false
                            );
                          }}
                        >
                          ✎
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
          onSave={(name, avatar) =>
            editing.id === 'new'
              ? addProfile(
                  name,
                  avatar
                )
              : (
                  setProfiles(
                    profiles.map(
                      x =>
                        x.id ===
                        editing.id
                          ? {
                              ...x,
                              name,
                              avatar
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
                        x.id !==
                        editing.id
                    )
                  );

                  const nextStates =
                    {
                      ...states
                    };

                  delete nextStates[
                    editing.id
                  ];

                  setStates(
                    nextStates
                  );

                  setEditing(null);

                  setProfileId(
                    'admin'
                  );
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
          onAdd={title => {
            setLibrary([
              ...library,
              title
            ]);

            setShowAdd(false);
          }}
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
                time
              }
            ]);

            setShowReminder(null);
          }}
        />
      )}

      {/* SCHEDULE RECOMMENDATION */}

      {showSchedule &&
        isAdmin && (
          <ScheduleModal
            title={showSchedule}
            profiles={profiles.filter(
              x => x.id !== 'admin'
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

      {/* HERO EDITOR */}

      {showHero && isAdmin && (
        <HeroModal
          hero={hero}
          library={library}
          onClose={() =>
            setShowHero(false)
          }
          onSave={settings => {
            setHero(settings);
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
              r =>
                r.profileId ===
                profileId
            ).length
          }

          reminder(s)
        </span>

        {isAdmin && (
          <span>
            {scheduled.length}
            {' '}
            scheduled reco(s)
          </span>
        )}

        <button
          onClick={() =>
            alert(
              'Browser push notifications will be added through the notification system.'
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
          alt={t.name}
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
            title="Remove title"
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

        {!isAdmin && (
          <div className="small-actions">

            <button
              onClick={onRewatch}
              className={
                st.rewatch.includes(
                  t.id
                )
                  ? 'on'
                  : ''
              }
            >
              ↻ Re-watch
            </button>

            <button
              onClick={onReminder}
            >
              <Bell size={14} />
              Remind me
            </button>

          </div>
        )}

        {isAdmin && (
          <div className="small-actions">

            <button
              onClick={onSchedule}
            >
              Schedule reco
            </button>

          </div>
        )}

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
          onChange={e =>
            setName(e.target.value)
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
          ].map(emoji => (
            <button
              className={
                avatar === emoji
                  ? 'picked'
                  : ''
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
              confirm(
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

/* --------------------------------------------------
   ADD TITLE
-------------------------------------------------- */

function AddTitle({
  library,
  onClose,
  onAdd
}: {
  library: Title[];
  onClose: () => void;
  onAdd: (title: Title) => void;
}) {
  const [q, setQ] =
    useState('');

  const [results, setResults] =
    useState<Title[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    const timer =
      setTimeout(
        async () => {
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
        },
        400
      );

    return () =>
      clearTimeout(timer);
  }, [q]);

  const available =
    results.filter(
      title =>
        !library.some(
          existing =>
            existing.id ===
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
          value={q}
          onChange={e =>
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
                {title.year}
                {' · '}
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
                  results.filter(
                    x =>
                      x.id !==
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
          onChange={e =>
            setDate(
              e.target.value
            )
          }
        />
      </label>

      <label>
        Time

        <input
          type="time"
          value={time}
          onChange={e =>
            setTime(
              e.target.value
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
        Push notifications will
        require browser notification
        permission and backend
        notification support.
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

      <label>
        Profile

        <select
          value={profileId}
          onChange={e =>
            setProfileId(
              e.target.value
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
          onChange={e =>
            setDate(
              e.target.value
            )
          }
        />
      </label>

      <label>
        Time

        <input
          type="time"
          value={time}
          onChange={e =>
            setTime(
              e.target.value
            )
          }
        />
      </label>

      <label>
        Message

        <textarea
          value={message}
          onChange={e =>
            setMessage(
              e.target.value
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
            titleId: title.id,
            date,
            time,
            message
          })
        }
      >
        Schedule
      </button>

    </Modal>
  );
}

/* --------------------------------------------------
   HERO EDITOR
-------------------------------------------------- */

/* --------------------------------------------------
   HERO EDITOR
-------------------------------------------------- */

function HeroModal({
  hero,
  library,
  onClose,
  onSave
}: {
  hero: HeroSettings | null;
  library: Title[];
  onClose: () => void;
  onSave: (
    settings: HeroSettings
  ) => void;
}) {
  const initialTitle =
    hero?.title || library[0];

  const [id, setId] =
    useState(
      initialTitle?.id || ''
    );

  const selectedTitle =
    library.find(
      x => x.id === id
    ) || initialTitle;

  /*
    IMAGE SETTINGS

    100% = automatic fit
    Width / Height can then be
    adjusted independently.
  */

  const [width, setWidth] =
    useState(
      hero?.width || 100
    );

  const [height, setHeight] =
    useState(
      hero?.height || 100
    );

  const [positionX, setPositionX] =
    useState(
      hero?.positionX || 50
    );

  const [positionY, setPositionY] =
    useState(
      hero?.positionY || 50
    );

  if (!selectedTitle) {
    return (
      <Modal
        title="Edit Hero"
        onClose={onClose}
      >
        <p className="muted">
          Add a movie or TV show first
          to create a hero.
        </p>

        <button
          className="pink full"
          onClick={onClose}
        >
          Close
        </button>
      </Modal>
    );
  }

  /*
    IMPORTANT:

    The preview uses the exact same
    aspect ratio as the main hero.

    The image starts at 100% / 100%
    and is contained inside the preview.
  */

  return (
    <Modal
      title="Edit Hero"
      onClose={onClose}
    >

      <p className="muted">
        Your image automatically fits
        the hero first. Adjust the size
        if you want, then fine-tune the
        crop and position.
      </p>

      {/* --------------------------------------------
         LARGE HERO PREVIEW
      -------------------------------------------- */}

      <div
        style={{
          width: '100%',
          aspectRatio: '16 / 6',
          minHeight: '220px',
          borderRadius: '16px',
          overflow: 'hidden',
          position: 'relative',
          background: '#111',
          marginBottom: '26px',
          border: '1px solid rgba(255,255,255,.08)'
        }}
      >

        {selectedTitle.backdrop ? (

          <img
            src={
              selectedTitle.backdrop
            }
            alt={
              selectedTitle.name
            }
            style={{
              position: 'absolute',

              /*
                At 100% the image fills
                the preview nicely.
              */
              width: `${width}%`,
              height: `${height}%`,

              /*
                Prevent the browser from
                shrinking the image.
              */
              maxWidth: 'none',
              maxHeight: 'none',

              /*
                Cover keeps the movie image
                looking natural when its
                proportions differ from
                the hero.
              */
              objectFit: 'cover',

              /*
                Position controls become
                the crop controls.
              */
              left: `${positionX}%`,
              top: `${positionY}%`,

              transform:
                'translate(-50%, -50%)',

              transition:
                'width .15s ease, height .15s ease, left .15s ease, top .15s ease'
            }}
          />

        ) : (

          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#888'
            }}
          >
            No backdrop available
          </div>

        )}

        {/* HERO OVERLAY */}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, rgba(0,0,0,.78), rgba(0,0,0,.08))',
            pointerEvents: 'none'
          }}
        />

        {/* PREVIEW TITLE */}

        <div
          style={{
            position: 'absolute',
            left: '26px',
            bottom: '24px',
            color: '#fff',
            pointerEvents: 'none',
            maxWidth: '65%'
          }}
        >

          <div
            style={{
              fontSize: '11px',
              letterSpacing: '2px',
              fontWeight: 700,
              opacity: 0.75,
              marginBottom: '6px'
            }}
          >
            FEATURED
          </div>

          <strong
            style={{
              fontSize:
                'clamp(20px, 3vw, 34px)',
              lineHeight: 1.1
            }}
          >
            {selectedTitle.name}
          </strong>

        </div>

      </div>

      {/* --------------------------------------------
         SELECT TITLE
      -------------------------------------------- */}

      <label>
        Hero title

        <select
          value={id}
          onChange={e => {

            setId(
              e.target.value
            );

            /*
              Whenever a new title is
              selected, start fresh with
              the automatic fit.
            */
            setWidth(100);
            setHeight(100);
            setPositionX(50);
            setPositionY(50);

          }}
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

      {/* --------------------------------------------
         IMAGE SIZE
      -------------------------------------------- */}

      <div
        style={{
          marginTop: '24px'
        }}
      >

        <strong>
          Image size
        </strong>

        <p className="muted">
          Start with the automatic fit.
          Increase or decrease the width
          and height if you want to change
          how much of the image fills the
          hero.
        </p>

        {/* WIDTH */}

        <label>

          Width

          <input
            type="range"
            min="80"
            max="160"
            step="1"
            value={width}
            onChange={e =>
              setWidth(
                Number(
                  e.target.value
                )
              )
            }
          />

          <span className="muted">
            {width}%
          </span>

        </label>

        {/* HEIGHT */}

        <label>

          Height

          <input
            type="range"
            min="80"
            max="160"
            step="1"
            value={height}
            onChange={e =>
              setHeight(
                Number(
                  e.target.value
                )
              )
            }
          />

          <span className="muted">
            {height}%
          </span>

        </label>

      </div>

      {/* --------------------------------------------
         CROP / POSITION
      -------------------------------------------- */}

      <div
        style={{
          marginTop: '26px'
        }}
      >

        <strong>
          Crop / Position
        </strong>

        <p className="muted">
          Once the size looks right,
          use these controls to move
          the image and choose which
          part is visible.
        </p>

        {/* HORIZONTAL */}

        <label>

          Horizontal

          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={positionX}
            onChange={e =>
              setPositionX(
                Number(
                  e.target.value
                )
              )
            }
          />

          <span className="muted">
            {positionX}%
          </span>

        </label>

        {/* VERTICAL */}

        <label>

          Vertical

          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={positionY}
            onChange={e =>
              setPositionY(
                Number(
                  e.target.value
                )
              )
            }
          />

          <span className="muted">
            {positionY}%
          </span>

        </label>

      </div>

      {/* --------------------------------------------
         RESET
      -------------------------------------------- */}

      <button
        className="ghost full"
        onClick={() => {

          setWidth(100);
          setHeight(100);
          setPositionX(50);
          setPositionY(50);

        }}
      >
        Reset image
      </button>

      {/* --------------------------------------------
         SAVE
      -------------------------------------------- */}

      <button
        className="pink full"
        onClick={() =>
          onSave({
            title: selectedTitle,
            width,
            height,
            positionX,
            positionY
          })
        }
      >
        Save Hero
      </button>

    </Modal>
  );
}

/* --------------------------------------------------
   START APP
-------------------------------------------------- */

createRoot(
  document.getElementById(
    'root'
  )!
).render(<App />);
