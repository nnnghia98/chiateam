## Sprint 3 – Match Command & Database Persistence (chiateam-bot)

**Period**: 2026, Sprint 3  
**Area**: Match data model, persistence, `/match` command

### Goals

- Persist match data (date, san, tiensan, teams) to the database instead of in-memory only.
- Add `/match` command to show or save matches with optional date override.
- Support future match result details (goals, assists, MVP) via schema.

### Key Changes

- **Database schema** (`src/script/tables.sql`):
  - `matches` – match_date, san, tiensan, home_score, away_score, notes.
  - `match_players` – lineups with player_id (nullable) and display_name for unresolved names.
  - `match_player_stats` – goals, assists, is_mvp for future per-player stats.

- **Matches API** (`src/api/matches.js`):
  - `getMatchByDate`, `getMatchWithPlayers` – fetch match with HOME/AWAY lineups (Name – Shirt Number) and per-player stats.
  - `createOrUpdateMatch` – upsert match and players from current san, tiensan, teams.
  - `listMatches`, `updateMatchResult` – list matches and update scores.
  - `getMatchPlayerStats`, `addMatchPlayerStatDelta`, `setMatchMvp`, `isPlayerInMatch` – per-player stats (goals, assists, MVP).

- **`/match` command** (`src/commands/match/match.js`):
  - `/match` – show this week’s Thursday match.
  - `/match SAVE` – save current state (san, tiensan, teams) as this week’s match.
  - `/match dd/mm/yyyy` – show match for that date.
  - `/match dd/mm/yyyy SAVE` – save current state for that date.
  - `/match 3-1` or `/match dd/mm/yyyy 3-1` – update score (HOME-AWAY).
  - `/match goal 10 2` – add 2 goals for player number 10.
  - `/match assist 10 1` – add 1 assist for player number 10.
  - `/match mvp 10` – set player number 10 as MVP.
  - Date format: dd/mm/yyyy. Thursday of week used when no date given.
  - Resolves team names to players when possible; otherwise stores display_name.
  - Match display shows goals, assists, MVP per player when available.

- **`/matches` command** (`src/commands/match/matches.js`):
  - `/matches` – list last 10 matches with date and score.
  - `/matches N` – list last N matches (max 20).

- **Other updates**:
  - `san.js` – export `getSan()` for match command.
  - `init-database.js` – create matches, match_players, match_player_stats.
  - `index.js` – wire matchCommand with getTiensan, teamA, teamB.
  - `start.js` – add `/match` to help list.
  - `messages.js` – add MATCH messages.

### Impact

- Match data survives server restarts.
- Match history can be queried and extended later (e.g. `/matches`, `/match_stats`).
- Schema supports future match result details (goals, assists, MVP) via `match_player_stats`.
