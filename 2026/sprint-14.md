# Sprint 14 - Command UX and API Hardening

**Period**: June 3-10, 2026
**Area**: Player media, command interactions, logging, and documentation

## Goals

- Improve player management in the admin panel.
- Make Telegram button flows work well with large player lists.
- Return command results to the chat and topic where the action started.
- Improve runtime logs and project documentation.

## Key Changes

### Player avatars

- Added player avatar fields and API support.
- Added Supabase Storage uploads through `api/services/avatar-storage-service.js`.
- Added an authenticated player avatar upload endpoint.
- Updated database setup and environment examples for avatar storage.

### Telegram command interactions

- Added paginated inline keyboards for commands that list players or members.
- Limited each page to 10 player or member buttons.
- Returned inline command prompts and results to the source chat and Telegram topic.
- Preserved admin permission checks when callback buttons are used.

### Reliability and project guidance

- Improved bot and API runtime logging.
- Expanded command tests and API tests.
- Refined the README and folder-specific agent guides.
- Removed old test entrypoints that no longer matched the active runtime.

## Product Impact

- Admins can manage player profile images.
- Large member lists remain usable on Telegram.
- Commands no longer send their result to an unrelated configured chat.
- Logs provide clearer information during development and deployment.

## Main Commits

- `3f12563` - add avatar support and related API improvements
- `dcb2320` - improve runtime logging
- `617a280` - add paginated inline command keyboards
- `38dc699` - reply to inline commands in the source chat
- `c3afa6c` - document inline command behavior

## Status

- [x] Player avatar storage is supported.
- [x] Inline player lists use pagination.
- [x] Inline replies keep the source chat and topic.
- [x] Current behavior is covered by focused tests and documentation.
