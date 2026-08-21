-- =========================================================
-- STREAMIX DATABASE SCHEMA
-- =========================================================

PRAGMA foreign_keys = ON;

-- =========================================================
-- PROFILES
-- =========================================================

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  sort_order INTEGER NOT NULL DEFAULT 9999,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_profiles_sort_order
  ON profiles(sort_order);


-- =========================================================
-- LOGIN SESSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (profile_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_profile
  ON sessions(profile_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires
  ON sessions(expires_at);


-- =========================================================
-- LIBRARY
-- =========================================================

CREATE TABLE IF NOT EXISTS library_items (
  id TEXT PRIMARY KEY,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  title TEXT NOT NULL,
  poster_path TEXT,
  backdrop_path TEXT,
  overview TEXT,
  release_date TEXT,
  vote_average REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_library_tmdb
  ON library_items(tmdb_id);

CREATE INDEX IF NOT EXISTS idx_library_title
  ON library_items(title);


-- =========================================================
-- WATCH HISTORY
-- =========================================================

CREATE TABLE IF NOT EXISTS watch_history (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  library_item_id TEXT NOT NULL,
  watched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(profile_id, library_item_id),

  FOREIGN KEY (profile_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  FOREIGN KEY (library_item_id)
    REFERENCES library_items(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_watch_history_profile
  ON watch_history(profile_id);

CREATE INDEX IF NOT EXISTS idx_watch_history_item
  ON watch_history(library_item_id);


-- =========================================================
-- WATCHLIST
-- =========================================================

CREATE TABLE IF NOT EXISTS watchlist (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  library_item_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'watchlist',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(profile_id, library_item_id),

  FOREIGN KEY (profile_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  FOREIGN KEY (library_item_id)
    REFERENCES library_items(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_watchlist_profile
  ON watchlist(profile_id);

CREATE INDEX IF NOT EXISTS idx_watchlist_item
  ON watchlist(library_item_id);


-- =========================================================
-- RE-WATCH
-- =========================================================

CREATE TABLE IF NOT EXISTS rewatch (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  library_item_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(profile_id, library_item_id),

  FOREIGN KEY (profile_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  FOREIGN KEY (library_item_id)
    REFERENCES library_items(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rewatch_profile
  ON rewatch(profile_id);

CREATE INDEX IF NOT EXISTS idx_rewatch_item
  ON rewatch(library_item_id);


-- =========================================================
-- REMINDERS
-- =========================================================

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  library_item_id TEXT NOT NULL,
  reminder_date TEXT NOT NULL,
  reminder_time TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (profile_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  FOREIGN KEY (library_item_id)
    REFERENCES library_items(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reminders_profile
  ON reminders(profile_id);

CREATE INDEX IF NOT EXISTS idx_reminders_date
  ON reminders(reminder_date);


-- =========================================================
-- SCHEDULED PERSONAL RECOMMENDATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS scheduled_recommendations (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  library_item_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT 'How about this one?',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (profile_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  FOREIGN KEY (library_item_id)
    REFERENCES library_items(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scheduled_profile
  ON scheduled_recommendations(profile_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_date
  ON scheduled_recommendations(scheduled_date);


-- =========================================================
-- HERO SETTINGS
-- =========================================================

CREATE TABLE IF NOT EXISTS hero_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  library_item_id TEXT,
  position_x REAL NOT NULL DEFAULT 50,
  position_y REAL NOT NULL DEFAULT 50,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (library_item_id)
    REFERENCES library_items(id)
    ON DELETE SET NULL
);


-- =========================================================
-- TODAY'S RECOMMENDATION STATUS
-- =========================================================

CREATE TABLE IF NOT EXISTS recommendation_status (
  profile_id TEXT PRIMARY KEY,
  seen_at TEXT,

  FOREIGN KEY (profile_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE
);


-- =========================================================
-- DEFAULT ADMIN PROFILE
-- =========================================================

INSERT OR IGNORE INTO profiles (
  id,
  name,
  avatar,
  sort_order
)
VALUES (
  'admin',
  'Admin',
  '👑',
  0
);


-- =========================================================
-- DEFAULT HERO SETTINGS
-- =========================================================

INSERT OR IGNORE INTO hero_settings (
  id,
  library_item_id,
  position_x,
  position_y
)
VALUES (
  1,
  NULL,
  50,
  50
);
