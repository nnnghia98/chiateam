## Sprint 5 – Match Linking & Web Console UX (chiateam-bot)

**Period**: 2026, Sprint 5  
**Area**: Match lineup ↔ player linking stability, and web console UI polish

### Goals

- Make `/match SAVE` reliably link lineup entries to the correct registered players without merging different people who share similar names.
- Ensure unregistered or ad-hoc names still appear in match lineups without polluting the `players` table.
- Polish the new web console so status, navigation, and conversations are easier to scan.

### Key Changes

- **Match save: resolve players by Telegram `user_id` first, then exact name** (`src/commands/match/match.js`, `src/utils/team-member.js`, `src/commands/add/add-me.js`, `src/commands/add/add.js`, `src/commands/team/*.js`, `src/commands/bench/*.js`):
  - Introduced `team-member` helper with an explicit entry shape `{ name, userId? }`, plus `toEntry`, `getDisplayName`, and `getUserId` so in-memory Maps can carry stable identifiers alongside display names.
  - Updated `/addme` to store members as `{ name, userId }` (Telegram ID), while `/add` continues to store `{ name }` for ad-hoc entries.
  - Propagated the structured entries through team/bench commands (`/chiateam`, `/addtoteam`, `/clearteam`, `/bench`, `/clearbench`) so teams always retain any associated `userId`.
  - Changed `resolvePlayer` in `/match` to:
    - Look up `getPlayerByUserId(userId)` when a Telegram ID is available (most stable).
    - Fall back to an **exact** case-insensitive name match against `players.name` when no ID is present.
    - Never use partial substring matching again (fixes the “Nghia” vs “Nghia2” bug).
  - Made `buildPlayerEntries` async and responsible for mapping `teamA`/`teamB` entries into `{ playerId, displayName }` via the new resolution rules, so `/match SAVE`:
    - Links registered players to `match_players.player_id` when resolvable.
    - Leaves unregistered/different names as `player_id = NULL` with only `display_name`, keeping them visible without altering the `players` table.

- **Web console layout tweaks** (`web/src/app/_components/AppShell.tsx`, `web/src/app/conversations/page.tsx`, `web/src/app/page.tsx`):
  - Refined sidebar branding: moved “CHIA TEAM / Bot Console” into a consistent footer block, using bolder typography for clearer product identity.
  - Simplified conversations tables by removing the “Last message” column in both the main dashboard and conversations page, focusing on user, command, status, and time.
  - Adjusted status badges and toggle buttons from fully rounded pills to rounded rectangles to better match the console’s design language.
  - Cleaned up minor indentation and layout issues in the dashboard statistic cards for more readable JSX.

### Impact

- `/match SAVE` now links lineups to registered players using a stable identifier (`user_id`) instead of fragile name heuristics, eliminating accidental merges like treating “Nghia2” as the same player as “Nghia”.
- Unregistered or temporary names still appear in match details as display-only entries, but they do not create or modify rows in the `players` table, keeping the roster clean.
- Team and bench commands consistently operate on the same structured member entries, so future features can safely rely on `userId` when available.
- The web console is visually clearer: key status information is easier to spot, and monitoring active commands/conversations requires less visual noise.

### Production hotfix – `players.user_id` schema

- **Fix**: Production `chamhet.db` had a legacy `players` table without a `user_id` column, causing `/register` to fail with `SQLITE_ERROR: no such column: user_id` once the bot started querying by `user_id`.
- **Migration**: Ran an in-place SQLite migration:
  - `ALTER TABLE players RENAME TO players_old;`
  - Recreated `players` with the new schema (including `user_id INTEGER NOT NULL UNIQUE`).
  - Backfilled existing rows via `INSERT INTO players (id, user_id, number, name, username, created_at, updated_at) SELECT id, -id, number, name, username, created_at, updated_at FROM players_old;` so legacy players get negative placeholder IDs consistent with the new logic.
  - Dropped `players_old` after verification.
- **Result**: `/register NUMBER` now works end‑to‑end in production and the database schema matches `src/script/tables.sql`, unblocking all new flows that rely on `players.user_id`.

