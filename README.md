# ChiaTeam Bot

Telegram bot and companion HTTP API for running ChiaTeam football sessions.

The bot handles weekly player signups, bench management, team shuffling, venue
and fee tracking, voting, player registration, match history, and leaderboard
updates. The API backs the separate admin UI and also acts as the bot's data
layer for players, matches, leaderboard stats, avatars, and persistent bot
state.

The admin UI lives in a separate repository:

```text
../chiateam-admin
```

## Project Layout

```text
bot/                 Telegram bot runtime and command handlers
api/                 HTTP API, data-access routes, and domain services
api/db/              Database connection and verification scripts
config/              Shared environment and maintenance-mode config
docs/                Deployment, Docker, migration, and integration notes
2026/                Historical sprint notes
docker-compose*.yml  Local and VPS Docker stacks
```

Important entrypoints:

- `bot/index.js` starts the Telegram bot.
- `api/index.js` starts the HTTP API.
- `config/load-env.js` loads the env file selected by `ENV_FILE`.
- `bot/utils/storage.js` manages the bot's persistent runtime state.

## Runtime Surfaces

### Bot

The bot is built with `node-telegram-bot-api` and registers command handlers
from `bot/commands/`.

Known commands registered by the active bot runtime:

| Area | Commands |
| ---- | -------- |
| Help | `/start` |
| Bench | `/addme`, `/add`, `/bench`, `/editbench`, `/clearbench` |
| Teams | `/chiateam`, `/team`, `/addtoteam`, `/clearteam` |
| Team constraints | `/manifest`, `/mf`, `/manifests`, `/removemanifest`, `/clearmanifests` |
| Venue and fees | `/san`, `/clearsan`, `/tiensan`, `/chiatien` |
| Attendance vote | `/taovote`, `/clearvote`, `/demvote`, `/sync` |
| Players and stats | `/register`, `/players`, `/me`, `/player`, `/edit-stats` |
| Matches | `/match`, `/matches` |
| Admin reset | `/reset` |

There are older handler files for standalone AI and leaderboard commands, but
`bot/index.js` does not currently register them. Keep README command docs tied
to the runtime wiring, not just files present under `bot/commands/`.

Interactive commands that use inline keyboards:

- `/clearbench`
- `/editbench`
- `/addtoteam`
- `/clearteam`
- `/manifest`
- `/removemanifest`

These commands are admin-only when they show or handle inline keyboard actions.
Inline keyboards show at most 10 players or manifest entries per page. Their
prompt and follow-up messages are sent back to the chat where the command or
button was used, including the same Telegram topic when available, instead of
using the configured `CHAT_ID`.

### API

The API uses Node's built-in `http` module and PostgreSQL via `pg`.

Core endpoints include:

- `GET /healthz`
- `GET /api/status`
- `GET /api/settings`
- `POST /api/settings`
- `GET /api/players`
- `GET /api/player-summaries`
- `GET /api/players/:number`
- `POST /api/players`
- `PUT /api/players/:number`
- `POST /api/players/:number/avatar`
- `DELETE /api/players/:number`
- `GET /api/matches`
- `GET /api/matches/:date`
- `POST /api/matches`
- `PUT /api/matches/:date`
- `DELETE /api/matches/:date`
- `PUT /api/leaderboard/:playerNumber`
- `GET /api/bot-storage`
- `POST /api/bot-storage`
- `POST /api/bot-storage/reset`
- `POST /api/bot-storage/sync`

Admin-only endpoints require:

```text
x-internal-api-auth: <INTERNAL_API_AUTH_TOKEN>
x-admin-role: admin
```

Viewer endpoints accept `x-admin-role: viewer` with the same internal token.

## Data Storage

Structured data is stored in PostgreSQL, usually Supabase Postgres, through
`DATABASE_URL`.

Main tables:

- `players`
- `leaderboard`
- `matches`
- `match_players`
- `match_player_stats`
- `current_match`

Player avatars are uploaded to Supabase Storage using:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

### Persistent Bot State

Next-match state must stay in the bot state JSON file.

- Default path: `.runtime/bot/storage.json`
- Override env var: `BOT_STATE_FILE`
- Example shape: `bot/storage.json.example`

This file stores current bench/team/vote/venue/fee state. Back it up before
risky storage changes, deployment cutovers, or manual resets. Do not migrate
next-match data elsewhere unless that storage change is explicitly approved.

## Environment Setup

This project uses root env files only:

- `.env` for local development and local Docker
- `.env.production` for production and VPS Docker

Do not reintroduce `.env.local` runtime paths.

Create the files from the templates:

```bash
cp .env.example .env
cp .env.production.example .env.production
```

Required or commonly used variables:

```text
TELEGRAM_BOT_TOKEN
BOT_OWNER_ID
BOT_ADMIN_IDS
CHAT_ID
MAIN_THREAD_ID
ANNOUNCEMENT_THREAD_ID
VIP_THREAD_ID
STATISTICS_THREAD_ID

API_PORT
BOT_STATE_FILE
BOT_API_BASE_URL
INTERNAL_API_AUTH_TOKEN
ADMIN_UI_URL

DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET

MAINTENANCE_MODE
MAINTENANCE_UNTIL
GEMINI_API_KEY
```

`GEMINI_API_KEY` is optional. When present, match flows can generate Vietnamese
AI commentary. When absent, AI helpers return `null` and normal match behavior
continues.

## Install

```bash
yarn install
```

## Local Development

Start the bot:

```bash
yarn dev:bot
```

Start the API:

```bash
yarn dev:api
```

`yarn dev` maps to `yarn dev:bot`.

The API defaults to:

```text
http://localhost:8787
```

Verify the API:

```bash
curl http://localhost:8787/healthz
```

## Production Commands

```bash
yarn start:bot
yarn start:api
```

`yarn start` maps to `yarn start:bot`.

The production scripts load `.env.production` by setting:

```text
NODE_ENV=production
ENV_FILE=.env.production
```

## Database Checks

Verify the configured database connection and ensure runtime helper columns or
tables exist:

```bash
yarn init-db
```

Drop scripts exist for development cleanup, but they are destructive:

```bash
yarn drop-db
```

Do not run destructive database commands against production unless the target
environment and backup plan are confirmed.

## Tests

There is no package-level test script yet. Run the Node test files directly:

```bash
node --test bot/**/*.test.js
```

Focused examples:

```bash
node --test bot/utils/command-filter.test.js
node --test bot/commands/team/chia-team.test.js
```

## Local Docker

Use native `yarn dev:*` commands for the fastest coding loop. Use Docker when
you need container parity for the bot and API together.

Development stack:

```bash
yarn docker:dev:up
yarn docker:dev:logs
yarn docker:dev:down
```

Production-parity stack:

```bash
yarn docker:prod:up
yarn docker:prod:down
```

In Docker, the bot should use:

```text
BOT_API_BASE_URL=http://api:8787
```

Both Docker stacks mount `.runtime/bot` so `storage.json` persists across
container restarts.

See `docs/LOCAL_DOCKER.md` for the full local runbook.

## VPS Deployment

The VPS deployment uses Docker Compose, GitHub Actions, and GHCR.

What runs on the VPS:

- `api` container listening on port `8787`
- `bot` container with no public port

Both containers share the same app image and use different start commands.

The deployment workflow backs up:

```text
.runtime/bot/storage.json
```

before rollout.

See `docs/DEPLOY_VPS_DOCKER.md` for required secrets, VPS prerequisites, and
the cutover checklist.

## Maintenance Mode

Set these in the active env file to pause bot/API traffic for the environment:

```text
MAINTENANCE_MODE=true
MAINTENANCE_UNTIL=2026-10-02 12:00
```

The bot responds to commands with a maintenance message. The API keeps health,
status, and settings routes available while maintenance mode is enabled.

## Additional Docs

- `docs/LOCAL_DOCKER.md` - local Docker workflow
- `docs/DEPLOY_VPS_DOCKER.md` - VPS Docker deployment
- `docs/DEPLOY_RENDER.md` and `docs/RAILWAY_SETUP.md` - older platform notes
- `docs/MIGRATION.md` - migration history
- `docs/JSON_STORAGE.md` - bot state storage notes
- `docs/AI_INTEGRATION.md` - AI integration notes; verify against current command wiring before enabling standalone AI commands
- `docs/HTTP_TEST_EXAMPLES.md` - sample API calls

Historical sprint notes in `2026/` may describe older layouts. Treat the root
scripts, `bot/index.js`, `api/index.js`, and current env examples as the active
source of truth.
