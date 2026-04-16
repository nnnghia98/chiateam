# ChiaTeam Bot

This repository runs two runtime surfaces:

- `bot/` for Telegram command handling and in-chat workflows
- `api/` for admin-facing HTTP endpoints

The admin UI now lives in a separate repository at `../chiateam-admin`.

## Start Commands

Root commands are the source of truth:

```bash
yarn dev:bot
yarn dev:api

yarn start:bot
yarn start:api
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
- `MAINTENANCE_MODE` to pause production traffic without affecting local dev
- `MAINTENANCE_UNTIL` for the bot/API maintenance message

Admin-specific auth/session variables now belong only in the separate admin repo.

## Bot State

Persistent next-match state is stored outside tracked source files and must always live in the bot state file.

- Default runtime file: `.runtime/bot/storage.json`
- Override path with `BOT_STATE_FILE`
- Example shape: `bot/storage.json.example`

Before implementation or deployment work that could affect this file, take a backup and restore it if needed.

## Project Notes

- Admin split migration completed on 2026-04-15.
- New admin codebase location: `../chiateam-admin`.
- Historical sprint notes in `2026/` are kept for reference and may describe older repo layouts.
- The legacy SQLite artifact under `bot/` is not part of the active runtime path.

## Docker VPS Deployment

- Compose stack definition: `docker-compose.yml`
- CI/CD workflow: `.github/workflows/deploy.yml`
- Full runbook: `docs/DEPLOY_VPS_DOCKER.md`

## Local Docker Development

Use the hybrid workflow:

- Day-to-day coding: native `yarn dev:bot`, `yarn dev:api`
- Containerized dev/parity: Docker Compose (`api` + `bot`)

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
