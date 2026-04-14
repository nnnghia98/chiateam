# ChiaTeam Bot

ChiaTeam is split into three runtime surfaces:

- `bot/` for Telegram command handling and in-chat workflows
- `api/` for admin-facing HTTP endpoints
- `admin/` for the Next.js admin UI

## Start Commands

Root commands are the source of truth:

```bash
yarn dev:bot
yarn dev:api
yarn dev:admin

yarn start:bot
yarn start:api
yarn start:admin
```

`yarn start` maps to `yarn start:bot`.

## Environment Setup

Root services read env from the repo root:

1. Copy `.env.local.example` to `.env.local` for local/dev runtime
2. Copy `.env.production.example` to `.env.production` for production runtime
3. Fill in Telegram, database, and runtime values for each environment

Important root variables:

- `DATABASE_URL`
- `API_PORT`
- `BOT_STATE_FILE`
- `BOT_API_BASE_URL` when the bot runs separately from the API
- `INTERNAL_API_AUTH_TOKEN`
- `ADMIN_UI_URL`

Admin runs with its own server-side env file:

1. Copy `admin/.env.example` to `admin/.env.local`
2. Fill in:
   - `API_INTERNAL_URL`
   - `INTERNAL_API_AUTH_TOKEN`
   - `ADMIN_SESSION_SECRET`
   - `ADMIN_PASSWORD`
   - `VIEWER_PASSWORD`

For Docker/VPS deployment, these admin variables can also be provided in `.env.local` and `.env.production`.

## Admin Access Model

The browser talks only to the Next.js proxy under `admin/src/app/api/proxy`.
The proxy:

- validates the admin session from an HTTP-only cookie
- forwards trusted role information to the API
- authenticates to the API with `INTERNAL_API_AUTH_TOKEN`

The API does not trust browser-supplied role headers.

## Bot State

Persistent next-match state is stored outside tracked source files and must always live in the bot state file.

- Default runtime file: `.runtime/bot/storage.json`
- Override path with `BOT_STATE_FILE`
- Example shape: `bot/storage.json.example`

Before implementation or deployment work that could affect this file, take a backup and restore it if needed.

## Project Notes

- The legacy public `web/` app has been removed.
- Historical sprint notes in `2026/` are kept for reference and may describe older repo layouts.
- The legacy SQLite artifact under `bot/` is not part of the active runtime path.

## Docker VPS Deployment

- Compose stack definition: `docker-compose.yml`
- CI/CD workflow: `.github/workflows/deploy.yml`
- Full runbook: `docs/DEPLOY_VPS_DOCKER.md`

## Local Docker Development

Use the hybrid workflow:

- Day-to-day coding: native `yarn dev:bot`, `yarn dev:api`, `yarn dev:admin`
- Full-stack containerized dev/parity: Docker Compose

Local Docker files:

- Dev stack (hot reload): `docker-compose.dev.yml`
- Prod parity stack: `docker-compose.yml`
- Local runbook: `docs/LOCAL_DOCKER.md`

Common commands:

```bash
yarn docker:dev:up
yarn docker:dev:logs
yarn docker:dev:down

yarn docker:prod:up
yarn docker:prod:down
```
