# Sprint 13 - Admin Panel Separation and Runtime Operations

**Period**: April 11-May 20, 2026
**Area**: Next-match management, deployment, maintenance mode, and team controls

## Goals

- Let admins manage the next match outside Telegram.
- Make bot state access consistent between the bot and API.
- Separate the admin panel web app from the bot repository.
- Improve operational safety and team management.

## Key Changes

### Next-match management

- Added a next-match page to the admin panel with drag-and-drop controls.
- Added API routes to read, update, reset, and sync bot storage.
- Moved bot storage access into `api/services/bot-storage-service.js`.
- Added `bot/utils/api-client.js` so the bot can use the same API-backed state.
- Persisted the active attendance vote with the current match state.

### Admin panel repository split

- Moved the admin panel web app to the separate `chiateam-admin` repository.
- Kept this repository responsible for the bot and the admin panel backend API.
- Updated Docker, Railway, migration, and environment documentation for the split.
- Migrated production deployment to Docker Compose and GHCR (GitHub Container Registry).

### Runtime operations

- Added maintenance mode for local and production use.
- Added clearer maintenance and shutdown messages.
- Reduced Telegram command listener load and centralized shared reply text.
- Standardized local development on the root `.env` file.

### Team management

- Added `/editbench` to rename a bench member.
- Prevented the same player from appearing across several teams.
- Improved two-team and three-team splitting behavior.
- Added manifest rules so admins can keep two players together or apart.

## Product Impact

- The admin panel can manage live next-match state through one API.
- The admin panel web app can be deployed without the bot source tree.
- Operators can pause the product during maintenance.
- Team creation has stronger identity and pairing rules.

## Main Commits

- `4c9cc18` - add next-match management
- `27f2371` - centralize next-match storage access
- `94ab444` - split the admin panel into its own repository
- `a73a7e6` - add production maintenance mode
- `3b0212a` - add bench rename and cross-team duplicate checks
- `8e31dc6` - add manifest commands and storage

## Status

- [x] Next-match state is available through the API.
- [x] The admin panel web app is maintained in a separate repository.
- [x] Maintenance mode works for the bot and API.
- [x] Bench editing, three-team splitting, and manifest rules are available.
