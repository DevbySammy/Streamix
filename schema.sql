-- Production-ready relational shape. One titles table for movies AND TV shows.
create type media_kind as enum ('movie','tv');
create type watch_status as enum ('watchlist','watched');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table titles (
  id uuid primary key default gen_random_uuid(),
  provider text,
  provider_id text,
  kind media_kind not null,
  title text not null,
  release_date date,
  overview text,
  poster_url text,
  backdrop_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(provider, provider_id)
);

create table profile_title_status (
  profile_id uuid not null references profiles(id) on delete cascade,
  title_id uuid not null references titles(id) on delete cascade,
  status watch_status not null,
  created_at timestamptz not null default now(),
  primary key(profile_id,title_id,status)
);

create table profile_rewatch (
  profile_id uuid not null references profiles(id) on delete cascade,
  title_id uuid not null references titles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(profile_id,title_id)
);

create table reminders (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references profiles(id) on delete cascade,
  title_id uuid not null references titles(id) on delete cascade, remind_at timestamptz not null,
  calendar_event_id text, push_sent_at timestamptz, created_at timestamptz not null default now()
);

create table scheduled_recommendations (
  id uuid primary key default gen_random_uuid(), admin_profile_id uuid not null references profiles(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade, title_id uuid not null references titles(id) on delete cascade,
  scheduled_for timestamptz not null, message text, sent_at timestamptz, created_at timestamptz not null default now()
);

create table hero_banner (
  id uuid primary key default gen_random_uuid(), title_id uuid references titles(id) on delete set null,
  image_url text, active boolean not null default true, updated_by uuid references profiles(id), updated_at timestamptz not null default now()
);

-- Critical rule: title deletion cascades to every profile's statuses, rewatch entries,
-- reminders and scheduled recommendations. No orphaned per-profile title rows remain.
-- Enable RLS in production and write policies so only is_admin=true can INSERT/DELETE titles,
-- edit hero_banner, edit profiles, and create scheduled recommendations. Profiles may only
-- SELECT the master library and INSERT/UPDATE/DELETE their own status/rewatch/reminders.
