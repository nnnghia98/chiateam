## Sprint 8 – Matches Tab with Accordion UI (chiateam-bot)

**Period**: 2026, Sprint 8  
**Area**: Add Matches management tab to web console with collapsible accordion interface

### Goals

- Add a dedicated "Matches" tab in the web console to display all match records.
- Show comprehensive match information including teams, players, scores, and individual stats.
- Implement accordion UI pattern to handle large numbers of matches efficiently.
- Provide easy navigation with expand/collapse controls.

### Key Changes

- **Backend API endpoints** (`src/api/server.js`):
  - Added `GET /api/matches` endpoint with pagination support (limit/offset query params).
    - Returns list of matches ordered by date descending.
    - Automatically fetches full player details for each match via `getMatchWithPlayers()`.
    - Maximum limit of 100 matches per request, defaults to 20.
  - Added `GET /api/matches/:date` endpoint to fetch a specific match by date (YYYY-MM-DD format).
  - Both endpoints return complete match data including home/away teams with player stats.
  - **Impact**: Web console can now fetch and display all match history with full details.

- **Frontend types and API functions** (`web/src/lib/api.ts`):
  - Added `MatchPlayer` type representing players in a match with:
    - Basic info: playerId, displayName, name, number, label
    - Stats: goals, assists, isMvp (boolean)
  - Added `Match` type with complete match details:
    - Match metadata: id, match_date, san (venue), tiensan (cost), scores, notes, timestamps
    - Teams: homePlayers and awayPlayers arrays of MatchPlayer objects
  - Added `fetchMatches(limit, offset)` function to retrieve paginated match list.
  - Added `fetchMatchByDate(date)` function to retrieve a specific match.
  - **Impact**: Type-safe match data handling throughout the frontend application.

- **Navigation update** (`web/src/app/_components/AppShell.tsx`):
  - Added "Matches" tab to navigation between "Players" and "Settings".
  - **Impact**: Easy access to match history from the main navigation menu.

- **Accordion component** (`web/src/app/matches/_components/MatchAccordion.tsx`):
  - Created interactive client-side accordion component with state management.
  - Features:
    - **Collapsible match cards**: Each match starts collapsed, click to expand.
    - **Expand All / Collapse All buttons**: Quick bulk actions for easy navigation.
    - **Status indicator**: Shows count of expanded matches (e.g., "3 of 20 expanded").
    - **Visual feedback**: Animated arrow (▶) rotates when expanded, hover effects on headers.
    - **Minimal spacing**: 8px gap between collapsed items for compact view.
  - Match card header (always visible when collapsed):
    - Match date in Vietnamese format
    - Venue (sân) and cost (tiền sân) icons
    - Final score in large, bold text
    - "Draw" indicator for tied matches
  - Match card content (visible when expanded):
    - Side-by-side home and away team rosters
    - "Winner" badge on the winning team
    - Player cards showing:
      - Player number and name
      - Goals (⚽) and assists (🎯) if recorded
      - MVP badge (🏆) for match MVP with highlighted background
  - **Impact**: Handles many matches efficiently, providing both quick overview and detailed information on demand.

- **Matches page** (`web/src/app/matches/page.tsx`):
  - Server-side component that fetches matches on page load.
  - Shows total count of recorded matches.
  - Displays empty state with helpful instructions if no matches exist.
  - Renders MatchAccordion component with match data.
  - Includes usage guide for Telegram commands:
    - `/match SAVE` - Save a match
    - `/match goal 10 2` - Record goals
    - `/match mvp 10` - Set MVP
  - **Impact**: Complete match history view with intuitive, scalable interface.

### Technical Details

- **Match data structure**:
  - Matches are stored in three tables:
    - `matches`: Core match data (date, venue, cost, scores, notes)
    - `match_players`: Player-to-match associations with side (HOME/AWAY)
    - `match_player_stats`: Individual player stats per match (goals, assists, MVP)
  - API automatically joins all three tables to return complete match objects.

- **Accordion pattern benefits**:
  - **Performance**: Only renders visible content, handles hundreds of matches smoothly.
  - **UX**: Provides high-level overview at a glance, details available on-demand.
  - **Scalability**: As match history grows, the interface remains clean and navigable.
  - **Mobile-friendly**: Works well on smaller screens by collapsing content by default.

- **Data flow**:
  - Matches saved via Telegram bot `/match SAVE` command.
  - Stats updated via `/match goal`, `/match assist`, `/match mvp` commands.
  - Web UI fetches from API endpoints at page load (server-side rendering).
  - Accordion state managed client-side for instant expand/collapse interactions.

### Impact

- **Complete match visibility**: Admins can now view entire match history in the web console with all details (teams, scores, stats).
- **Efficient navigation**: Accordion pattern allows quick scanning of many matches without overwhelming the interface.
- **Player performance tracking**: Individual goals, assists, and MVP awards visible for each match.
- **Better insights**: Easy to see match results, winning teams, and top performers at a glance.
- **Scalable design**: Interface will continue to work well as match history grows over time.
- **Foundation for analytics**: Match data structure ready for future features like statistics dashboards, player performance trends, win/loss records, etc.

### Files Created

**Frontend**:
- `web/src/app/matches/page.tsx` – Main Matches page (server component)
- `web/src/app/matches/_components/MatchAccordion.tsx` – Interactive accordion component (client component)

### Files Modified

**Backend**:
- `src/api/server.js` – Added `/api/matches` and `/api/matches/:date` endpoints

**Frontend**:
- `web/src/lib/api.ts` – Added Match and MatchPlayer types, fetchMatches() and fetchMatchByDate() functions
- `web/src/app/_components/AppShell.tsx` – Added Matches navigation item

---

## Sprint 8 – 3-Team Split & Team State Improvements (chiateam-bot)

**Area**: Extend team management to support splitting into 3 teams, with independent 2-team and 3-team views, and a persistent bench roster

### Goals

- Allow admins to split players into 3 teams (HOME / AWAY / EXTRA) in addition to the existing 2-team split.
- Let both 2-team and 3-team assignments coexist independently.
- Fix a bias bug where the odd-member extra slot always went to a fixed team.
- Change the bench to act as the persistent player roster (never cleared by `/chiateam` or `/chiateam 3`).

### Key Changes

- **`/chiateam` — randomised odd-member distribution** (`src/commands/team/chia-team.js`):
  - Previously `Math.ceil` always gave the extra slot to HOME on an odd-numbered bench.
  - Now a coin flip decides which team receives the extra member, so both teams have equal probability of being the larger one.
  - Same fix applied to the "add to existing teams" path (when teams already have members), where the tie-break coin is rolled once before the loop so the extra member is randomly assigned.

- **New `/chiateam 3` command** (`src/commands/team/chia-team.js`):
  - Admin-only. Requires at least 3 bench members.
  - Shuffles all bench players and distributes them evenly across three teams — HOME (`team3A`), AWAY (`team3B`), EXTRA (`team3C`).
  - For player counts not divisible by 3, the extra slot(s) are randomly assigned to teams (shuffled index pool), so no team is always larger.
  - Completely independent from the 2-team split: calling `/chiateam 3` does not affect `teamA`/`teamB`, and vice versa.

- **New `/team 3` command** (`src/commands/team/team.js`):
  - Shows the 3-team roster (`team3A`, `team3B`, `team3C`).
  - `/team` continues to show only the 2-team roster (`teamA`, `teamB`).
  - Both views can be active at the same time since they use separate in-memory Maps.

- **Bench is now the persistent roster** (`src/commands/team/chia-team.js`, `src/commands/team/add-to-team.js`, `src/commands/team/clear-team.js`):
  - `/chiateam` and `/chiateam 3` copy bench members into team Maps but **no longer clear the bench**.
  - `/addtoteam HOME|AWAY|EXTRA` adds a bench member to a team without removing them from the bench.
  - `/clearteam` / `/clearteam HOME|AWAY|EXTRA` clears team Maps only; members remain accessible in the bench.
  - The bench is the single source of truth for all attending players; team Maps are view-only assignments derived from it.

- **`/addtoteam EXTRA` support** (`src/commands/team/add-to-team.js`):
  - Regex extended from `HOME|AWAY` to `HOME|AWAY|EXTRA`.
  - `EXTRA` maps to `team3C` (the 3rd team in the 3-team split).

- **`/clearteam EXTRA` support** (`src/commands/team/clear-team.js`):
  - Regex extended to include `EXTRA`.
  - `/clearteam` with no argument now clears all five Maps (`teamA`, `teamB`, `team3A`, `team3B`, `team3C`).
  - `VALIDATION` placeholder bug fixed: `{teamNum}` replaced with `{teamType}` so examples display the correct command (e.g. `/clearteam HOME 1,3`).
  - Success and instruction messages updated to remove references to "moved back to bench" (no longer applicable).

- **`/match SAVE` — EXTRA players persisted** (`src/commands/match/match.js`, `src/api/matches.js`):
  - `buildPlayerEntries` now accepts `team3C` and resolves its members as `extraPlayers`.
  - `createOrUpdateMatch` accepts an optional `extraPlayers` array and inserts them into `match_players` with `side = 'EXTRA'`.
  - `getMatchWithPlayers` collects EXTRA-side rows into a separate `extraPlayers` array on the match object.
  - `formatMatchMessage` renders an **EXTRA** section below HOME and AWAY when `extraPlayers` is non-empty.

- **Independent state architecture** (`src/index.js`):
  - Added three new in-memory Maps: `team3A`, `team3B`, `team3C`.
  - `teamA` / `teamB` are exclusively for the 2-team split.
  - `team3A` / `team3B` / `team3C` are exclusively for the 3-team split.
  - All relevant commands wired with the correct Maps.

- **`/start` help text updated** (`src/commands/common/start.js`):
  - Team management section now lists `/chiateam 3` (admin) and `/team 3`.

### Technical Details

- **5 independent Maps** replace the previous 2:

  | Map | Owner command | Displayed by |
  |-----|--------------|--------------|
  | `teamA` | `/chiateam` | `/team` |
  | `teamB` | `/chiateam` | `/team` |
  | `team3A` | `/chiateam 3` | `/team 3` |
  | `team3B` | `/chiateam 3` | `/team 3` |
  | `team3C` | `/chiateam 3` | `/team 3`, `/match SAVE` (EXTRA side) |

- **3-team size algorithm**: `base = floor(N / 3)`, `remainder = N % 3`. A shuffled index pool `[0,1,2]` determines which teams receive the extra slot(s), guaranteeing equal probability across all three teams.

- **EXTRA side in DB**: The `match_players.side` column already stores arbitrary strings. `'EXTRA'` is the new value used for 3-team members, with no schema migration required.

### Impact

- Admins can now run both `/chiateam` and `/chiateam 3` independently; both views remain active until explicitly cleared.
- The bench is always accessible via `/bench` even after splitting — no data loss from accidental re-splits.
- Fair randomisation ensures no team is systematically larger in odd-count splits.

### Files Modified

- `src/commands/team/chia-team.js` – Rewrote split logic; added `/chiateam 3`
- `src/commands/team/team.js` – Added `/team 3`; split into 2-team / 3-team Maps
- `src/commands/team/add-to-team.js` – Added `EXTRA` support; removed bench deletion
- `src/commands/team/clear-team.js` – Added `EXTRA` support; updated to 5-Map clear; removed move-to-bench
- `src/commands/management/chia-tien.js` – Reverted to `teamA + teamB` total (no EXTRA duplication)
- `src/commands/match/match.js` – Added `team3C` / `extraPlayers` support
- `src/api/matches.js` – Added EXTRA side to `getMatchWithPlayers` and `createOrUpdateMatch`
- `src/utils/messages.js` – Updated `CLEAR_TEAM`, `CLEAR_TEAM_INDIVIDUAL` messages; added EXTRA hint to `ADD_TO_TEAM`
- `src/commands/common/start.js` – Added `/chiateam 3` and `/team 3` to help text
- `src/index.js` – Added `team3A`, `team3B`, `team3C` Maps; updated all command wiring

### Future Enhancements

- Add filtering by date range, venue, or player
- Add sorting options (by date, score, venue)
- Add search functionality to find specific matches
- Add pagination controls for very large match histories
- Add statistics summary (total matches, average scores, most common venues)
- Add match details page with deeper analytics (possession, shots, fouls, etc.)
- Add export functionality (CSV, PDF reports)
- Add ability to edit match details from web UI
- Add ability to delete matches from web UI (currently Telegram-only)
- Add visual charts/graphs for match statistics over time
