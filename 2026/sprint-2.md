## Sprint 2 – CRUD/API Layer & Folder Restructure (chiateam-bot)

**Period**: 2026, Sprint 2  
**Area**: Backend architecture, DB access layering

### Goals

- Decouple Telegram command handlers from direct database/SQL access.
- Introduce a clear service/API layer between commands and persistence.
- Separate database connection/setup concerns from table-level CRUD logic.

### Key Changes

- **Repository/API extraction**
  - Normalized table-level CRUD for `players` and `leaderboard` into low-level repositories.
  - Ensured these modules are SQL-only (no user-facing validation or Telegram logic).

- **New `src/api/` folder**
  - Moved repository modules to:
    - `src/api/players.js` – CRUD for the `players` table (create, read by user/number, list, update, delete, search).
    - `src/api/leaderboard.js` – CRUD + batch ops for the `leaderboard` table (ordered fetch, match result batching, goal/assist updates).
  - `src/db/` is now focused strictly on DB setup:
    - `config.js`, `init-database.js`, `drop-database.js`.

- **Service/domain layer**
  - Added `src/services/player-service.js`:
    - `registerPlayer({ teleUser, number })` with validation and structured error codes (`INVALID_NUMBER`, `ALREADY_REGISTERED`, `NUMBER_IN_USE`, `UNEXPECTED_ERROR`).
    - `getPlayerByTelegramId(teleId)` thin wrapper around the repository.
  - Added `src/services/leaderboard-service.js`:
    - `getLeaderboardForDisplay()` on top of the leaderboard repository.
    - `applyMatchResult({ result, playerNumbers })` with validation and structured error codes (`INVALID_RESULT`, `NO_VALID_PLAYER_IDS`, `UNEXPECTED_ERROR`).
    - `updateGoalStat({ playerNumber, delta })` / `updateAssistStat({ playerNumber, delta })` with input validation and shared error model.
    - Re-exports of stats helpers (`getPlayerStats`, `getMultiplePlayerStats`, `upsertTotals`) for commands that need detailed control.

- **Command refactors**
  - **`/register`** (`src/commands/player/register.js`):
    - Now calls `player-service.registerPlayer` instead of hitting the DB repository directly.
    - Maps service result codes to `REGISTER.invalidNumber`, `REGISTER.duplicateUserId`, `REGISTER.duplicateNumber`, and `REGISTER.error`.
  - **Leaderboard-related commands** (`src/commands/leaderboard/*.js`):
    - `/leaderboard` now uses `leaderboard-service.getLeaderboardForDisplay`.
    - `/update-leaderboard` delegates:
      - `WIN/LOSE/DRAW` updates to `leaderboard-service.applyMatchResult`.
      - `GOAL`/`ASSIST` updates to `leaderboard-service.updateGoalStat` / `updateAssistStat`.
    - `/player` and `/edit-stats` now consume stats helpers from the service layer instead of importing DB modules directly.
  - Ensured no command imports from `src/db/**`; commands depend only on services (and, in one case, the new `src/api/players.js` module).

- **Tests & documentation**
  - Added lightweight service tests under `tests/services/`:
    - `player-service.test.js` – covers invalid number handling in `registerPlayer`.
    - `leaderboard-service.test.js` – covers invalid result handling in `applyMatchResult`.
  - Updated backend docs:
    - Clarified layering and responsibilities in the code and sprint documentation.
    - Kept `2026/sprint-1.md` focused on earlier backend hardening; this sprint documents the new command–service–repository split and the `src/api/` folder.

### Impact

- Commands are now thinner and focused on parsing, permissions, and response formatting.
- Business rules and persistence logic are centralized in services and repositories, making future changes (e.g., adding HTTP APIs or swapping storage) significantly easier.
- DB setup (`src/db/`) is clearly separated from the table APIs (`src/api/`), reducing coupling and improving maintainability.

