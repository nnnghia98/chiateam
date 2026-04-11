# API Agent Guide

This folder is the HTTP API server that backs the admin UI and serves as the data layer for the ChiaTeam bot.

The entrypoint is [index.js](./index.js). It initialises crash logging, then calls `createUiApiServer` from [routes/server.js](./routes/server.js) and starts listening.

Default port resolution order: `API_PORT` → `UI_API_PORT` → `PORT` → `8787`.

---

## What Lives Here

### Entrypoint

- [index.js](./index.js)
  Bootstraps the API process. Sets up `uncaughtException` / `unhandledRejection` / signal handlers, then starts the server.

### Database

- [db/config.js](./db/config.js)
  Exports a single `pg.Pool` instance (`db`). Connection string comes from `DATABASE_URL`. SSL is enabled only in production.

- [db/tables.sql](./db/tables.sql)
  Reference schema for the five tables: `players`, `leaderboard`, `matches`, `match_players`, `match_player_stats`.

- [db/init-database.js](./db/init-database.js)
  One-shot script to create tables in the target database.

- [db/drop-database.js](./db/drop-database.js)
  One-shot script to drop all tables. **Destructive — do not run in production without confirmation.**

### Routes (also act as data-access repositories)

- [routes/server.js](./routes/server.js)
  Core HTTP router built on Node's built-in `http` module. Handles CORS, auth, JSON parsing, and dispatches every endpoint to the appropriate route/service function.

- [routes/players.js](./routes/players.js)
  Repository for the `players` table. All SQL for player CRUD lives here.

- [routes/matches.js](./routes/matches.js)
  Repository for `matches`, `match_players`, and `match_player_stats`. Handles match creation, lineup management, score updates, goal/assist deltas, and MVP assignment.

- [routes/leaderboard.js](./routes/leaderboard.js)
  Repository for the `leaderboard` table. Handles ordered fetches, batch match-result application (with a dedicated pg client for transactions), upserts, and individual goal/assist increments.

### Services (domain logic layer)

- [services/player-service.js](./services/player-service.js)
  Domain logic for player registration: validates input, prevents duplicates, handles admin-created placeholder slots (negative `user_id`), and returns typed result objects (`{ ok, code, data }`).

- [services/leaderboard-service.js](./services/leaderboard-service.js)
  Domain logic for leaderboard operations: validates result strings (`WIN`/`LOSE`/`DRAW`), normalises player number arrays, and delegates to the repository.

- [services/ai-service.js](./services/ai-service.js)
  Gemini AI integration. Provides two functions:
  - `generateMatchSummary(matchData)` — generates a fun Vietnamese commentary snippet.
  - `parseMatchResultText(text)` — parses a natural-language Vietnamese match result into structured JSON (`home_score`, `away_score`, `goals[]`, `assists[]`).
    Returns `null` when `GEMINI_API_KEY` is not set.

---

## Database Schema (quick reference)

| Table                | Key columns                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `players`            | `id`, `user_id` (Telegram ID, negative = placeholder), `number` (shirt), `name`, `username`                                |
| `leaderboard`        | `player_number` (FK → players.number), `total_match`, `total_win`, `total_lose`, `total_draw`, `winrate`, `goal`, `assist` |
| `matches`            | `id`, `match_date` (unique, YYYY-MM-DD), `san`, `tiensan`, `home_score`, `away_score`, `notes`                             |
| `match_players`      | `match_id`, `player_id` (nullable for guests), `side` (`HOME`/`AWAY`/`EXTRA`), `display_name`                              |
| `match_player_stats` | `match_id`, `player_id`, `goals`, `assists`, `is_mvp`                                                                      |

---

## HTTP API Endpoints

### No auth required

| Method | Path                    | Description                                                  |
| ------ | ----------------------- | ------------------------------------------------------------ |
| `GET`  | `/healthz`              | Health check — returns `200 ok`                              |
| `GET`  | `/api/status`           | Server status and public settings snapshot                   |
| `GET`  | `/api/players`          | List all players ordered by name                             |
| `GET`  | `/api/players/:number`  | Get single player by shirt number                            |
| `GET`  | `/api/player-summaries` | Players joined with their leaderboard stats                  |
| `GET`  | `/api/matches`          | List matches (`?limit=20&offset=0`) with full player rosters |
| `GET`  | `/api/matches/:date`    | Single match with players (date = `YYYY-MM-DD`)              |

### Requires authentication (viewer or admin)

Header: `x-internal-api-auth: <INTERNAL_API_AUTH_TOKEN>` and `x-admin-role: viewer` (or `admin`).

| Method | Path            | Description           |
| ------ | --------------- | --------------------- |
| `GET`  | `/api/settings` | Read runtime settings |

### Requires admin role

Header: `x-admin-role: admin` in addition to auth header above.

| Method   | Path                             | Description                                                                    |
| -------- | -------------------------------- | ------------------------------------------------------------------------------ |
| `POST`   | `/api/settings`                  | Update `maintenanceMode`, `debugLogging`, `botCommandPrefix`, `allowedChatIds` |
| `POST`   | `/api/players`                   | Create admin-managed player (no Telegram ID)                                   |
| `PUT`    | `/api/players/:number`           | Update player `name` or `username` by shirt number                             |
| `DELETE` | `/api/players/:number`           | Delete player and their leaderboard row                                        |
| `POST`   | `/api/matches`                   | Create a new match                                                             |
| `PUT`    | `/api/matches/:date`             | Update match fields (`san`, `tiensan`, scores, `notes`)                        |
| `DELETE` | `/api/matches/:date`             | Delete match (cascades to players and stats)                                   |
| `PUT`    | `/api/leaderboard/:playerNumber` | Overwrite leaderboard entry for a player                                       |

---

## Authentication Model

Auth is internal (server-to-server) only:

1. The caller sends `x-internal-api-auth` with the value of `INTERNAL_API_AUTH_TOKEN`.
2. In development, the token defaults to `local-internal-api-token-change-me` when the env var is absent.
3. The role (`admin` / `viewer`) is set via `x-admin-role`.
4. CORS is checked against an allowlist: `localhost:3000`, `localhost:8389`, plus `WEB_UI_URL` and `ADMIN_UI_URL` from env.

---

## Domain Result Pattern

Service functions return plain objects, not thrown errors:

```js
// Success
{ ok: true, player: {...} }

// Failure
{ ok: false, code: 'NUMBER_IN_USE', data: { player: {...} } }
```

Known error codes: `INVALID_NAME`, `INVALID_NUMBER`, `ALREADY_REGISTERED`, `NUMBER_IN_USE`, `NOT_FOUND`, `INVALID_RESULT`, `NO_VALID_PLAYER_IDS`, `UNEXPECTED_ERROR`.

---

## How To Work In This Folder

- All SQL goes in the route files (`routes/players.js`, `routes/matches.js`, `routes/leaderboard.js`). Do not write raw queries in server.js or service files.
- Domain validation and business rules belong in `services/`. Route files are pure data-access.
- `routes/server.js` is the only file that maps HTTP paths to handlers. Add new endpoints there.
- Use the `db` pool from `db/config.js` for all queries. Use a dedicated client (`db.connect()`) only when you need a transaction.
- Return typed result objects (`{ ok, code, data }`) from service functions. Let `server.js` translate them to HTTP status codes.
- `ai-service.js` is optional — always guard with a `null` check on its return value.
