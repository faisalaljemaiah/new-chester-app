# New Chester Clinic

Online psychiatry and psychology clinic: a patient app (Expo) and a bilingual practitioner dashboard (Next.js) on Supabase.

See [docs/PLAN.md](docs/PLAN.md) for the full plan, data model, open decisions and the Supabase setup steps.

| | |
|---|---|
| ![Patient home](docs/screenshots/p-home.png) | ![Dashboard patient file](docs/screenshots/patient-en.png) |

## Layout

```
apps/patient      Expo app for patients (iOS, Android, web)
apps/dashboard    Next.js practitioner dashboard (English / Arabic)
packages/shared   Row types, theme, slot calculation, questionnaire scoring
supabase          Database migration (tables, access rules, functions), seed data, access tests
```

## Run it

Requires Node 22 and a Supabase project with the migration and seed applied (see "Setting up the Supabase project" in [docs/PLAN.md](docs/PLAN.md)).

```bash
npm install

# Put the project URL and publishable key in both files
cp apps/dashboard/.env.example apps/dashboard/.env.local
cp apps/patient/.env.example apps/patient/.env.local

npm run dashboard   # http://localhost:3000
npm run patient     # press w for web, or scan the QR code with Expo Go
```

## Checks

```bash
npm run typecheck   # all packages
npm run test:db     # access rules and database functions, on an in-process Postgres
npm run seed:sql    # regenerate supabase/seed.sql after changing the questionnaires
```
