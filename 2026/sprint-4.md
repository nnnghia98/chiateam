## Sprint 4 – /register Flow Hardening, Admin Features & /players (chiateam-bot)

**Period**: 2026, Sprint 4  
**Area**: `/register` command stability, admin-only register/delete, and `/players` list with stats

### Goals

- Harden the `/register` flow against missing context, race conditions, and unclear UX.
- Add admin-only actions: register a slot for another person, and delete a player by shirt number.
- Add `/players` command to show all registered players and their match stats (total match, win/lose/draw, goals, assists, winrate).

### Key Changes

- **/register flow fixes** (`src/commands/player/register.js`, `src/services/player-service.js`, `src/api/players.js`, `src/utils/messages.js`):
  - Guard `msg.from`: if missing, reply with `REGISTER.needPrivateChat` and return; wrap the numeric handler in try/catch to avoid unhandled rejections.
  - Success message: normalize `username` so `null` is shown as “Chưa có” instead of the string `"null"`.
  - SQLite UNIQUE errors: in `player-service`, when `createPlayer` throws `SQLITE_CONSTRAINT`, map to `NUMBER_IN_USE` or `ALREADY_REGISTERED` and return the same shape as existing errors so users get the right message under race.
  - `getPlayerByNumber` in `src/api/players.js` now returns `null` (not `undefined`) when no row exists.
  - Unmatched args: handler for `/register` with extra text (e.g. `/register 10 Nghia`) sends `REGISTER.instruction` instead of no reply.
  - Validate non-empty `first_name` in the service; return `INVALID_NAME` and map to `REGISTER.invalidName` in the command.
  - Default error branch logs `result.error ?? result` for unknown error shapes.
  - New message: `REGISTER.needPrivateChat` for missing sender context.

- **Admin: register for another** – `/register NAME NUMBER` (admin only):
  - **API** (`src/api/players.js`): `getNextPlaceholderUserId()`, `createPlayerWithPlaceholder(name, number)`, `updatePlayerByNumber(number, updates)`. Admin-created slots use a negative `user_id` (no schema change); a user can later “claim” the slot with `/register NUMBER`.
  - **Service** (`src/services/player-service.js`): `registerPlayerForAnother({ name, number })` with validation; in `registerPlayer` (self), if a player with that number has `user_id < 0`, the slot is claimed by updating that row with the current user’s data.
  - **Command**: Handler `/^\/register (.+) (\d+)$/`; uses `requireAdmin(msg)`; success uses `REGISTER.registeredForAnotherSuccess`.

- **Admin: delete by number** – `/register NUMBER DELETE` (admin only):
  - **API** (`src/api/players.js`): `deletePlayerByNumber(number)` deletes the player and the corresponding leaderboard row.
  - **Service** (`src/services/player-service.js`): `deletePlayerByNumber(number)` returns `{ ok: true }` or `{ ok: false, code: 'NOT_FOUND' }`.
  - **Command**: Handler `/^\/register (\d+) DELETE$/i`; uses `requireAdmin(msg)`; replies with `REGISTER.deleteSuccess` or `REGISTER.deleteNotFound`.

- **Messages** (`src/utils/messages.js`):
  - New: `needPrivateChat`, `registeredForAnotherSuccess`, `deleteSuccess`, `deleteNotFound`.
  - `REGISTER.instruction` updated to document `/register NAME NUMBER` and `/register NUMBER DELETE` (admin only).

- **Tests** (`tests/services/player-service.test.js`):
  - `INVALID_NAME` when `first_name` is null, empty, or only whitespace.
  - Constraint mapping: when `createPlayer` rejects with UNIQUE on `players.number`, service returns `NUMBER_IN_USE` with `data.player` (Jest mock of `api/players`).

- **/players command** (`src/commands/player/players.js`, `src/utils/messages.js`):
  - New command `/players`: lists all registered players (from `players` table via `getAllPlayers`) with stats from `leaderboard` (`getMultiplePlayerStats`).
  - Per player: name, shirt number, total match / win / lose / draw, goals, assists, winrate. Players without a leaderboard row show zeros.
  - Messages: `PLAYERS.header`, `PLAYERS.empty`, `PLAYERS.error`. Reply uses `STATISTICS` thread like `/leaderboard`.
  - Command registered in `src/commands/index.js`, `src/index.js`; added to start menu and `COMMANDS` in `src/utils/constants.js`.

### Impact

- `/register` is more stable: no crash on missing `msg.from`, no “null” in success text, correct messages on duplicate number/user under concurrency, and clear reply when usage is wrong.
- Admins can pre-create slots with `/register NAME NUMBER`; the intended person claims the slot with `/register NUMBER`.
- Admins can remove a player (and their leaderboard entry) with `/register NUMBER DELETE`.
- Handler order is: `/register` → `/register NUMBER DELETE` → `/register NUMBER` (self) → `/register NAME NUMBER` (admin) → fallback instruction.
- `/players` gives a single view of all registered players and their match stats (total matches, W/L/D, goals, assists, winrate) in the statistics thread.
