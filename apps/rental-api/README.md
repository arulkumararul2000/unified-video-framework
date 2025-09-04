# Rental API (Stripe + Pesapal)

Implements the per-video rental paywall flow. Keep the player payment-agnostic and unlock playback after entitlement is true.

## Commands

- Install deps: (from repo root)
  - npm install
- Build: (from repo root)
  - npm run build:rental-api
- Dev server (hot reload):
  - cd apps/rental-api && npm run dev
- Start (compiled):
  - cd apps/rental-api && npm start

## Env

Copy .env.example to .env and set values.

## Migrations

Run SQL in migrations/001_init.sql on your Postgres DB (or use your migration tool). A simple script scaffolding is included in scripts/run-migration.js.

