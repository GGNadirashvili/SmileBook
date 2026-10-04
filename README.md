# SmileBook

Georgian dental marketplace and scheduling platform: find a trusted dentist who can see you when you want, know roughly what it costs, and book instantly.

- `web/` — React + Vite + TypeScript + Tailwind frontend (Georgian UI)
- `supabase/` — Postgres schema, availability/booking functions, RLS policies, test seed data

## Database setup (Supabase)

In the Supabase dashboard → SQL Editor, run in order:

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_functions.sql`
3. `supabase/migrations/0003_rls.sql`
4. `supabase/seed.sql` (fictional test clinics, dentists, reviews)
5. After creating test users in Authentication → Users: `supabase/dev_roles.sql`

## Frontend

```bash
cd web
cp .env.example .env   # fill in your Supabase URL and anon key
npm install
npm run dev
```
