## Sprint 6 – Match Stats & Players Management (chiateam-bot)

**Period**: 2026, Sprint 6  
**Area**: Match-level goal/assist tracking, leaderboard integration, and dedicated Players web tab

### Goals

- Fix the disconnect between `/match goal/assist` updates and the `/players` command so match-level stats appear in player summaries.
- Remove the unused "Conversations" feature from the web console to simplify the UI.
- Add a dedicated "Players" management tab in the web console showing all registered players with their match stats.

### Key Changes

- **Wire match stats into leaderboard** (`src/commands/match/match.js`):
  - When `/match goal 10 4` or `/match assist 10 1` is used to record a player's performance in a specific match:
    - The command continues to write to `match_player_stats` (per-match detail).
    - Now **also** calls `updateGoalStat({ playerNumber, delta })` and `updateAssistStat({ playerNumber, delta })` from `leaderboard-service` to increment the aggregated `leaderboard.goal` and `leaderboard.assist` columns.
  - **Impact**: `/players` now correctly shows total goals/assists from all matches, not just from manual `/update-leaderboard GOAL/ASSIST` commands.

- **Remove Conversations logging** (`src/api/server.js`, `src/index.js`, `web/src/lib/api.ts`, `web/src/app/_components/AppShell.tsx`, `web/src/app/page.tsx`, `web/src/app/conversations/page.tsx`):
  - Deleted the ring buffer and `logConversationEvent` function from the UI API server.
  - Removed the `bot.on('message', ...)` listener that logged every Telegram message to the in-memory buffer.
  - Removed `GET /api/conversations` endpoint.
  - Deleted `ConversationItem` type and `fetchConversations()` from the frontend API.
  - Deleted the `/conversations` page entirely.
  - Removed "Conversations" from the sidebar navigation.
  - Updated dashboard to rename "Recent conversations" to "Recent examples" and "New Test Conversation" button to "Ping bot".
  - **Impact**: Simplified the codebase by removing a feature that was not being actively used, reducing maintenance overhead.

- **Add Players management tab** (`src/api/server.js`, `web/src/lib/api.ts`, `web/src/app/_components/AppShell.tsx`, `web/src/app/players/page.tsx`):
  - Added new navigation tab "Players" between "Dashboard" and "Settings" in the web console.
  - Implemented backend endpoints:
    - `GET /api/players` – returns all players from the `players` table.
    - `GET /api/player-summaries` – joins players with their leaderboard stats (matches, wins/loses/draws, goals, assists, winrate).
    - `POST /api/players` and `DELETE /api/players/:number` – hooks for future create/delete functionality (currently unused by UI).
  - Created `/players` page that:
    - Fetches all player summaries via `fetchPlayerSummaries()`.
    - Displays a table with columns: **Number, Name, Username, Matches, Goals, Assists, Join date**.
    - Shows total registered player count.
    - Includes a note that registration is currently done via the `/register` Telegram command.
  - **Impact**: Admins can now see all registered players and their key stats (matches played, goals, assists, join date) at a glance in the web console, making it easier to monitor player engagement and performance.

### Technical Details

- **Match stats flow**:
  - `match_player_stats` table: stores per-match, per-player stats (goals, assists, MVP for each match).
  - `leaderboard` table: stores aggregated career stats (total matches, goals, assists across all matches).
  - Before: `/match goal/assist` only updated `match_player_stats`, so `/players` (which reads from `leaderboard`) showed 0.
  - After: `/match goal/assist` updates both tables, keeping them in sync.

- **API endpoints**:
  - `GET /api/player-summaries` performs a join-like operation:
    - Fetches all players from `players` table.
    - Fetches stats for all player numbers from `leaderboard` via `getMultiplePlayerStats`.
    - Maps them together and returns `{ player, stats }` objects.

### Impact

- **Match stats now flow to player profiles**: Recording goals/assists via `/match` commands immediately updates player totals visible in `/players` command and web console.
- **Cleaner web console**: Removed unused Conversations feature, reducing visual clutter and simplifying navigation.
- **Players management**: New dedicated Players tab provides a comprehensive view of all registered players with key performance metrics, making it easier to track player activity and stats.
- **Foundation for future features**: The Players API endpoints are ready to support create/delete operations and more detailed player management UI when needed.

### Files Changed

**Backend**:
- `src/commands/match/match.js` – Added `updateGoalStat` and `updateAssistStat` calls
- `src/api/server.js` – Removed Conversations endpoint, added Players endpoints
- `src/index.js` – Removed message logging listener

**Frontend**:
- `web/src/app/_components/AppShell.tsx` – Replaced Conversations nav with Players nav
- `web/src/app/players/page.tsx` – New Players management page
- `web/src/app/page.tsx` – Renamed conversation references to examples
- `web/src/app/conversations/page.tsx` – Deleted
- `web/src/lib/api.ts` – Removed ConversationItem, added Player types and endpoints
