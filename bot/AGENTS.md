# Bot Agent Guide

This folder is the Telegram bot runtime.

The active runtime starts at [index.js](./index.js). There is no longer a live nested `bot/bot/` entrypoint.

## What Lives Here

- [index.js](./index.js)
  Main bot bootstrap. It loads env, creates shared runtime state, and registers commands.

- [telegram-client.js](./telegram-client.js)
  Telegram client creation and polling/webhook error wiring.

- [storage.json.example](./storage.json.example)
  Example persisted-state shape. With `DATABASE_URL`, real runtime state lives in PostgreSQL table `storage` and is mirrored to the configured `BOT_STATE_FILE`; default local/VPS file path is `/api/data/bot/storage.json`, while Railway should use a volume path such as `/data/bot/storage.json`.

- `chamhet.db` is a removed legacy artifact. Do not recreate or treat it as the
  active runtime database unless a task explicitly requires a data recovery.

## Command Layout

Active commands are defined by `core/commands/command-manifest.js` and wired by
the shared runtime. The handlers under `commands/` remain for compatibility and
supporting utilities; they are not a second supported command registry.

Use these folders as the first place to look:

- [commands/common](./commands/common)
  Base handlers like `/start` and unknown-command fallback.

- [commands/add](./commands/add)
  Join/add flows such as `/add` and `/addme`.

- [commands/bench](./commands/bench)
  Bench inspection and reset flows.

- [commands/team](./commands/team)
  Team creation, viewing, editing, and clearing.

- [commands/player](./commands/player)
  Player lookup and self-registration flows.

- [commands/leaderboard](./commands/leaderboard)
  Leaderboard rendering and manual stat edits.

- [commands/match](./commands/match)
  Match save, view, and match-history workflows.

- [commands/management](./commands/management)
  Venue, cost, reset, and voting/admin-ish flows.

- [commands/ai](./commands/ai)
  AI command entrypoints and AI helper logic.

- [commands/maintainance](./commands/maintainance)
  Maintenance-mode response text used by the top-level gate in the bot bootstrap.

## Shared Utilities

- [utils/storage.js](./utils/storage.js)
  Shared mutable runtime state for bench, teams, costs, votes, and reset behavior. Treat PostgreSQL table `storage` plus the configured bot storage JSON mirror as persistent state, keep next-match data there, and back both up before risky changes.

- [utils/chat.js](./utils/chat.js)
  Message sending helpers.

- [utils/permissions.js](./utils/permissions.js)
  Permission and access checks.

- [utils/messages.js](./utils/messages.js)
  Shared user-facing text helpers.

- [utils/command-logger.js](./utils/command-logger.js)
  Global command logging hook.

- [utils/constants.js](./utils/constants.js)
  Shared constants.

- [utils/format.js](./utils/format.js), [utils/validate.js](./utils/validate.js), [utils/shuffle.js](./utils/shuffle.js), [utils/team-member.js](./utils/team-member.js)
  Reusable helpers that should be preferred over command-local copies.

## How To Work In This Folder

- Start from the matching command folder under `commands/` when changing behavior.
- Check [index.js](./index.js) to see how that command receives state and shared dependencies.
- If a change touches bench/team/vote/cost state, inspect [utils/storage.js](./utils/storage.js) before editing command code.
- Reuse helpers from `utils/` instead of duplicating formatting, validation, or permission logic.
- For Telegram inline keyboards that list players or members, show at most 10 player/member buttons per page by default and add pagination controls when there are more.
- Do not add runtime writes to tracked files inside `bot/`. Persisted state belongs in the API storage service.
- Do not move next-match data out of PostgreSQL table `storage` plus the configured bot storage JSON mirror unless the user explicitly approves that storage change.
