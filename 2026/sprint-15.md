# Sprint 15 - World Cup Predictions and Persistent Bot State

**Period**: June 12-July 31, 2026
**Area**: Prediction APIs, match scores, PostgreSQL bot storage, and fee settlement

## Goals

- Add a World Cup prediction feature for the community.
- Store match scores and prediction results safely.
- Move live bot state to PostgreSQL while keeping a JSON backup mirror.
- Improve match-day team and fee workflows.

## Key Changes

### World Cup predictions

- Added prediction endpoints and `api/services/world-cup-predictions-service.js`.
- Added database tables and a `worldcup.json` import command for match data.
- Added admin controls to open, close, settle, and reopen prediction matches.
- Added persistent match scores and uncensored prediction results after settlement.
- Updated tournament seed data through the knockout rounds.

### Persistent bot state

- Added PostgreSQL table `storage` as the primary home for live bot state.
- Kept the configured `BOT_STATE_FILE` JSON file as a fallback and backup mirror.
- Added safe first-read migration from the JSON mirror into an empty database table.
- Moved the Railway JSON mirror to the mounted data volume.
- Made `GET /api/bot-storage` public for the separate admin panel web app.

### Match-day workflow

- Skipped players who did not choose a coming option during vote-to-bench sync.
- Refreshed teams from stored state before showing the current lineup.
- Added water-fee support to the two-team fee split.
- Added production storage backup handling before deployment changes.

## Product Impact

- The community can submit and review World Cup predictions.
- Bot state survives process restarts and stateless deployments.
- The JSON mirror remains available for recovery.
- Attendance, teams, and fee totals are more accurate on match day.

## Main Commits

- `ab5dcb6` - add World Cup prediction endpoints
- `35316c0` - add World Cup match import
- `5536634` - add World Cup match scores
- `5123acb` - add database-backed bot storage
- `31dc39d` - allow public bot storage reads
- `e622498` - add water fee team split

## Status

- [x] Prediction data and match scores are stored in PostgreSQL.
- [x] Admins can control prediction match state.
- [x] Bot state uses PostgreSQL with a JSON mirror.
- [x] Vote sync, team refresh, and fee settlement are updated.
