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

1. Copy `.env.example`
2. Fill in Telegram, database, and runtime values
3. Use `.env.dev` for local bot/API development when needed

Important root variables:

- `DATABASE_URL`
- `API_PORT`
- `BOT_STATE_FILE`
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

## Admin Access Model

The browser talks only to the Next.js proxy under `admin/src/app/api/proxy`.
The proxy:

- validates the admin session from an HTTP-only cookie
- forwards trusted role information to the API
- authenticates to the API with `INTERNAL_API_AUTH_TOKEN`

The API does not trust browser-supplied role headers.

## Bot State

Ephemeral team state is stored outside tracked source files.

- Default runtime file: `.runtime/bot/storage.json`
- Override path with `BOT_STATE_FILE`
- Example shape: `bot/storage.json.example`

## Project Notes

- The legacy public `web/` app has been removed.
- Historical sprint notes in `2026/` are kept for reference and may describe older repo layouts.
- The legacy SQLite artifact under `bot/` is not part of the active runtime path.
