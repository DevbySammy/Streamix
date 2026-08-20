CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  sort_order INTEGER NOT NULL DEFAULT 9999,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE INDEX IF NOT EXISTS idx_profiles_sort_order
  ON profiles(sort_order);

CREATE INDEX IF NOT EXISTS idx_watch_history_profile
  ON watch_history(profile_id);

CREATE INDEX IF NOT EXISTS idx_watchlist_profile
  ON watchlist(profile_id);
