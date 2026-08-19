# Streamix

A mobile-first personal household movie + TV library prototype.

## Run

```bash
npm install
npm run dev
```

## What is included
- One master `titles` concept for movies and TV shows.
- Profile-specific watched, watchlist and re-watch state.
- Admin-only UI controls in the prototype.
- Mock API/search flow with an adapter-friendly data shape.
- Today's Reco popup that avoids watched titles.
- Reminders and admin-scheduled personal recommendations stored locally in demo mode.
- Responsive hero banner editor and required upload specifications.
- Production database schema in `schema.sql` using cascading foreign keys.

## Important production note
The browser-only demo cannot provide real security. Before putting this on the public internet, connect it to a real authentication/database backend (for example Supabase) and enforce the admin rules with server-side authorization/RLS. Never put a movie API secret in frontend code.

## API adapter
The mock titles already use a normalized shape: `id`, `name`, `kind`, `year`, `poster`, `backdrop`, `overview`. Replace the mock search/add implementation with a server-side API route that maps your chosen provider into this same shape. The UI does not need to change.

## Cloudflare
This is a Vite static frontend and can be deployed as a Cloudflare Pages project. If you add server-side API proxying, use Cloudflare Workers/Functions and store secrets as environment variables.
