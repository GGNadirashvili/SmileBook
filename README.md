# SmileBook

Georgian dental marketplace and scheduling platform: find a trusted dentist who can see you when you want, know roughly what it costs, and book instantly.

- `web/` — React + Vite + TypeScript + Tailwind frontend (Georgian UI)
- `supabase/` — Postgres schema, availability/booking functions, RLS policies, test seed data

## Database setup (Supabase)

In the Supabase dashboard → SQL Editor:

1. Run `supabase/setup_all.sql` (schema + functions + security policies + fictional test data).
   It is the four files below concatenated: `migrations/0001_schema.sql`, `0002_functions.sql`, `0003_rls.sql`, `seed.sql`.
   Regenerate after edits: `cat supabase/migrations/000*.sql supabase/seed.sql > supabase/setup_all.sql`
2. After creating test users in Authentication → Users (tick "Auto confirm"): run `supabase/dev_roles.sql`.

Map tiles come from openstreetmap.org (fine for development). Before real traffic, switch the tile URL in
`web/src/components/MapView.tsx` and `MiniMap.tsx` to a keyed provider (MapTiler, Stadia, etc.).

## Frontend

```bash
cd web
cp .env.example .env   # fill in your Supabase URL and anon key
npm install
npm run dev
```
