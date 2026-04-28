# Renter Guardian — Strapi backend (MVP)

Strapi **5** application: **structured data and relations** live here; **file bytes** use **Firebase Storage** in production, with **Cloud Functions** minting signed URLs (see **`docs/Phase0Contract.md`**). The Expo app calls **Firebase Cloud Functions** only; Functions talk to Strapi and Storage (see **`docs/STRAPI_MIGRATION.md`** and **`docs/Phase1StrapiProductionReadiness.md`**).

**Deploy:** Strapi Cloud builds from a **standalone GitHub repo** (this `strapi/` tree at repo root)—see Phase 1 checklist.

## Requirements

- Node **20–24** (see `package.json` engines)

## Commands

| Command | Description |
|---------|-------------|
| `npm run develop` | Dev server + admin (http://localhost:1337/admin) |
| `npm run build` | Build admin panel for production |
| `npm run start` | Production server (after `build`) |

## Database

Default local config uses **SQLite** (`.tmp/data.db`, gitignored). For staging/production, set `DATABASE_CLIENT=postgres` and related env vars per `config/database.ts`.

## Content-types

Defined under `src/api/*/content-types/*/schema.json` (app profiles, properties, spaces, photos, photo assignments, reports, inspections, inspection steps, user preferences).

After changing schemas, run `npm run develop` once so Strapi applies migrations.

## Full migration plan

See **`docs/STRAPI_MIGRATION.md`** in the repo root.
