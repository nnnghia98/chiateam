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

## Quick Start

Use Node.js 22, Yarn 1, and a PostgreSQL database. Bootstrap the project once:

```bash
yarn setup
```

This copies `.env.example` to `.env` only when `.env` does not exist, then
installs the locked dependencies. Add your own values to `.env` before running
the application.

For a fresh database, run `api/db/postgres-schema.sql` once, then verify the
connection and runtime tables:

```bash
yarn init-db
```

Start the API and Telegram bot together:

```bash
yarn dev:all
```

This command does not start Zalo or Messenger delivery. Both platforms use
separate webhook deployments. See `docs/DATABASE_SETUP.md` for database
details.

## Project Layout

```text
bot/                 Telegram bot runtime and command handlers
core/                Platform-independent command contracts and football rules
platforms/           Thin platform input/output adapters
runtime/             Shared command wiring and repository adapters
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
- `api/messenger-webhook.mjs` handles the Messenger webhook entrypoint.
- `config/load-env.js` loads the root `.env` file.
- `bot/utils/storage.js` manages the bot's persistent runtime state.

## Runtime Surfaces

### Bot

The bot uses a shared platform-independent command runtime. Telegram input,
output, polls, permissions, and callbacks stay under `platforms/telegram/`.
The supported command list is defined once in
`core/commands/command-manifest.js`; `/start` help and command filtering are
generated from that manifest.

Known commands registered by the active bot runtime:

| Area              | Commands                                                                       |
| ----------------- | ------------------------------------------------------------------------------ |
| Help              | `/start`                                                                       |
| Zalo messaging    | `/zalosay`, `/say`                                                             |
| Bench             | `/addme`, `/add`, `/bench`, `/editbench`, `/clearbench`                        |
| Teams             | `/chiateam`, `/team`, `/addtoteam`, `/clearteam`                               |
| Team constraints  | `/manifest`, `/mf`, `/manifests`, `/removemanifest`, `/clearmanifests`         |
| Venue and fees    | `/san`, `/clearsan`, `/tiensan`, `/tiennuoc`, `/winner`, `/loser`, `/chiatien` |
| Attendance vote   | `/taovote`, `/clearvote`, `/demvote`, `/sync`                                  |
| Players and stats | `/register`, `/players`, `/me`, `/player`, `/edit-stats`                       |
| Matches           | `/match`, `/matches`                                                           |
| Admin reset       | `/reset`                                                                       |

Standalone AI, old leaderboard-update, and unsupported World Cup names are not
part of the supported bot runtime.

### Supported Platforms

- Telegram is the primary adapter and runs the full command catalog.
- Zalo uses the production webhook and exposes only `/start`, `/zalosay`,
  `/subscribe`, `/unsubscribe`, `/poll`, `/vote`, `/demvote`, `/bench`, and `/team`.
- Zalo roster and team mutation commands are intentionally disabled.
- Messenger has a local webhook MVP with only `/start`, `/poll`,
  `/vote 0|1|2|3|4`, `/demvote`, `/bench`, and `/team`.
- Messenger `/vote` is the only write command. Admin, registration, roster,
  and team mutation commands are not available. Delivery is webhook-only.
- One installation manages one football community.

Important rewritten command forms:

- `/zalosay MESSAGE` previews a Zalo subscriber broadcast from Telegram.
  It is admin-only, requires confirmation within ten minutes, and uses
  `ZALO_BOT_TOKEN` on the Telegram bot service. Each recipient opts in with
  `/subscribe` in a private Zalo chat and can stop with `/unsubscribe`.
  `ZALO_BOT_OWNER_ID` is no longer the broadcast destination.
  See [Zalo broadcast setup](docs/ZALO_BROADCAST.md) for deployment and status commands.
- `/clearvote confirm` requires confirmation.
- `/reset` runs immediately and is admin-only.
- `/register NUMBER`, `/register add NAME NUMBER`, or
  `/register delete NUMBER`.
- `/edit-stats NUMBER matches=N wins=N losses=N draws=N`.
- `/match view|save|sync|score|winner|loser|goal|assist|mvp|delete ...` uses one explicit action.
- `/match sync [dd/mm/yyyy]` links saved match entries to players who
  registered later. It uses Telegram `user_id` and skips duplicate identities.
  Older unlinked entries without a stored `user_id` must be saved again first.
- `/match winner HOME [dd/mm/yyyy]` or `/match loser AWAY [dd/mm/yyyy]`
  updates registered player win/loss totals without double-counting the same result.
- `/matches [LIMIT] [PAGE]` and `/players [PAGE]` support bounded pages.

Interactive commands that use inline keyboards:

- `/clearbench`
- `/editbench`
- `/addtoteam`
- `/clearteam`
- `/manifest`
- `/removemanifest`
- `/clearmanifests`
- `/clearvote`

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
`GET /api/bot-storage` is public and does not require authentication headers.

## Data Storage

Structured data is stored in PostgreSQL, usually Supabase Postgres, through
`DATABASE_URL`.

Main tables:

- `players`
- `leaderboard`
- `matches`
- `match_players`
- `match_player_stats`
- `storage`
- `current_match`

Player avatars are uploaded to Supabase Storage using:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

### Persistent Bot State

Next-match state is stored in PostgreSQL table `storage` when `DATABASE_URL` is
configured. The API also mirrors the state to the bot state JSON file as a
fallback and backup.

- Table: `storage`
- JSON mirror default local/VPS path: `/api/data/bot/storage.json`
- JSON mirror Railway volume path: `/data/bot/storage.json` when the volume is mounted at `/data`
- JSON mirror override env var: `BOT_STATE_FILE`
- Example shape: `bot/storage.json.example`

The stored state includes current bench/team/vote/venue/fee values. Back up the
`storage` table and the JSON mirror before risky storage changes, deployment
cutovers, or manual resets. On first DB-backed read, the API seeds an empty
`storage` table from the JSON mirror for a safe cutover.

## Environment Setup

Every environment owns one root `.env` file with its own values. Runtime and
Docker commands always load `.env`; they do not select environment-suffixed
files. `NODE_ENV` may still identify development or production behavior, but it
does not change which env file is loaded.

`yarn setup` creates the file safely. To create it manually instead, run:

```bash
cp .env.example .env
```

Required or commonly used variables:

```text
TELEGRAM_BOT_TOKEN
BOT_OWNER_ID
BOT_ADMIN_IDS
ZALO_BOT_TOKEN
ZALO_BOT_OWNER_ID
MESSENGER_PAGE_ID
MESSENGER_PAGE_ACCESS_TOKEN
MESSENGER_APP_SECRET
MESSENGER_VERIFY_TOKEN
MESSENGER_GRAPH_API_VERSION
MESSENGER_ADMIN_IDS
MESSENGER_WEBHOOK_URL
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
yarn setup
```

If `.env` already exists and only dependencies are needed, run
`yarn install --frozen-lockfile`.

## Local Development

Start the API and Telegram bot together:

```bash
yarn dev:all
```

Or start each process in its own terminal. Start the API first:

```bash
yarn dev:api
```

Then start the bot:

```bash
yarn dev:bot
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

The production scripts load `.env` and keep the runtime mode as:

```text
NODE_ENV=production
```

## Database Checks

Verify the configured database connection and ensure runtime helper columns and
tables exist:

```bash
yarn init-db
```

For a fresh database, apply `api/db/postgres-schema.sql` before this command.
See `docs/DATABASE_SETUP.md` for fresh setup, existing database checks, and
backup rules.

Drop scripts exist for development cleanup, but they are destructive:

```bash
yarn drop-db
```

Do not run destructive database commands against production unless the target
environment and backup plan are confirmed.

## Tests

Run the full Node test suite:

```bash
yarn test
```

Focused examples:

```bash
node --test core/use-cases/matches/match-command.test.js
node --test runtime/start-bot.test.js
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

Both Docker stacks mount `api/data/bot` to `/api/data/bot` so the JSON mirror
persists across container restarts.

See `docs/LOCAL_DOCKER.md` for the full local runbook.

## Railway Storage

The PostgreSQL `storage` table is primary on Railway. The volume-backed JSON
file is still useful as a mirror and recovery backup.

Railway volumes persist only at their configured mount path. If the `api` volume
is mounted at `/data`, keep this on the Railway **api** service:

```text
BOT_STATE_FILE=/data/bot/storage.json
```

The app also falls back to `${RAILWAY_VOLUME_MOUNT_PATH}/bot/storage.json` on
Railway when `BOT_STATE_FILE` is not set. See `docs/RAILWAY_SETUP.md` before a
Railway deployment or storage recovery.

## VPS Deployment

The VPS deployment uses Docker Compose, GitHub Actions, and GHCR.

What runs on the VPS:

- `api` container listening on port `8787`
- `bot` container with no public port

Both containers share the same app image and use different start commands.

The deployment workflow backs up:

```text
/api/data/bot/storage.json
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
- `docs/DATABASE_SETUP.md` - fresh database setup and migration safety
- `docs/ADAPTER_DEVELOPMENT.md` - platform adapter boundaries and workflow
- `docs/MESSENGER_ADAPTER.md` - Messenger webhook MVP and Meta setup
- `docs/TROUBLESHOOTING.md` - common local, API, state, and Zalo problems
- `docs/RELEASE.md` - release checklist and versioning policy
- `docs/JSON_STORAGE.md` - bot state storage notes
- `docs/AI_INTEGRATION.md` - AI integration notes; verify against current command wiring before enabling standalone AI commands
- `docs/HTTP_TEST_EXAMPLES.md` - sample API calls

See `SECURITY.md` to report a security issue. Never commit `.env`, tokens,
database credentials, production storage, or database files.

Historical sprint notes in `2026/` may describe older layouts. Treat the root
scripts, `bot/index.js`, `api/index.js`, and current env examples as the active
source of truth.
