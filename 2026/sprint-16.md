# Sprint 16 - Shared Command Runtime and Match Media

**Period**: August 3-24, 2026
**Area**: Platform-independent commands, match media, results, and player linking

## Goals

- Prepare the bot commands for more than one chat platform.
- Add media records to saved matches.
- Improve saved match results and player identity links.
- Keep attendance vote state correct after restarts.

## Key Changes

### Shared command architecture

- Added `core/` for command contracts, football rules, and use cases.
- Added `platforms/telegram/` as a thin Telegram input/output adapter.
- Added `runtime/` to connect commands, platform adapters, and API repositories.
- Added one command manifest for help text, routing, access, and supported platforms.
- Added tests for command routing, use cases, adapters, and repository connections.

### Match media

- Added match media API routes and `api/services/match-media-service.js`.
- Added YouTube URL parsing and media metadata support.
- Added a Postman collection and a multi-platform implementation plan.

### Match results and player links

- Added `/match winner` and `/match loser` result updates.
- Added `/match sync` to link saved match entries to players who register later.
- Used Telegram `user_id` to avoid linking two people with similar names.
- Made `/reset` immediate for admins.
- Loaded the active vote before processing a Telegram poll answer.

## Product Impact

- Football rules can be reused by Telegram, Zalo, and Messenger adapters.
- Saved matches can include related media.
- Match result rows record winner and loser status for each player.
- Player statistics are less likely to attach to the wrong person.
- Attendance votes continue correctly after a process restart.

## Main Commits

- `19f2629` - add match media APIs and the platform plan
- `eb17685` - migrate commands to the shared runtime
- `8964353` - add match winner and loser updates
- `e348f63` - add match player sync
- `55737c6` - sync players by user ID
- `f048302` - load active vote before poll answers

## Status

- [x] Telegram runs through the shared command runtime.
- [x] Match media APIs are available.
- [x] Match results support winner and loser updates.
- [x] Saved match players can be linked by stable user identity.
