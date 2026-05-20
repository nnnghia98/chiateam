# Bot Agent Guide

This folder is the Telegram bot runtime.

The active runtime starts at [index.js](/Users/nnnghia98/Projects/chiateam-bot/bot/index.js). There is no longer a live nested `bot/bot/` entrypoint.

## What Lives Here

- [index.js](/Users/nnnghia98/Projects/chiateam-bot/bot/index.js)
  Main bot bootstrap. It loads env, creates shared runtime state, and registers commands.

- [telegram-client.js](/Users/nnnghia98/Projects/chiateam-bot/bot/telegram-client.js)
  Telegram client creation and polling/webhook error wiring.

- [storage.json.example](/Users/nnnghia98/Projects/chiateam-bot/bot/storage.json.example)
  Example persisted-state shape. Real runtime state lives in `.runtime/bot/storage.json` via `BOT_STATE_FILE`.

- [chamhet.db](/Users/nnnghia98/Projects/chiateam-bot/bot/chamhet.db)
  Legacy local artifact. Do not treat it as the active runtime database unless a task explicitly says to.

## Command Layout

All bot commands are registered through [commands/index.js](/Users/nnnghia98/Projects/chiateam-bot/bot/commands/index.js).

Use these folders as the first place to look:

- [commands/common](/Users/nnnghia98/Projects/chiateam-bot/bot/commands/common)
  Base handlers like `/start` and unknown-command fallback.

- [commands/add](/Users/nnnghia98/Projects/chiateam-bot/bot/commands/add)
  Join/add flows such as `/add` and `/addme`.

- [commands/bench](/Users/nnnghia98/Projects/chiateam-bot/bot/commands/bench)
  Bench inspection and reset flows.

- [commands/team](/Users/nnnghia98/Projects/chiateam-bot/bot/commands/team)
  Team creation, viewing, editing, and clearing.

- [commands/player](/Users/nnnghia98/Projects/chiateam-bot/bot/commands/player)
  Player lookup and self-registration flows.

- [commands/leaderboard](/Users/nnnghia98/Projects/chiateam-bot/bot/commands/leaderboard)
  Leaderboard rendering and manual stat edits.

- [commands/match](/Users/nnnghia98/Projects/chiateam-bot/bot/commands/match)
  Match save, view, and match-history workflows.

- [commands/management](/Users/nnnghia98/Projects/chiateam-bot/bot/commands/management)
  Venue, cost, reset, and voting/admin-ish flows.

- [commands/ai](/Users/nnnghia98/Projects/chiateam-bot/bot/commands/ai)
  AI command entrypoints and AI helper logic.

- [commands/maintainance](/Users/nnnghia98/Projects/chiateam-bot/bot/commands/maintainance)
  Maintenance-mode response text used by the top-level gate in the bot bootstrap.

## Shared Utilities

- [utils/storage.js](/Users/nnnghia98/Projects/chiateam-bot/bot/utils/storage.js)
  Shared mutable runtime state for bench, teams, costs, votes, and reset behavior. Treat `.runtime/bot/storage.json` as persistent state, keep next-match data there, and back it up before risky changes.

- [utils/chat.js](/Users/nnnghia98/Projects/chiateam-bot/bot/utils/chat.js)
  Message sending helpers.

- [utils/permissions.js](/Users/nnnghia98/Projects/chiateam-bot/bot/utils/permissions.js)
  Permission and access checks.

- [utils/messages.js](/Users/nnnghia98/Projects/chiateam-bot/bot/utils/messages.js)
  Shared user-facing text helpers.

- [utils/command-logger.js](/Users/nnnghia98/Projects/chiateam-bot/bot/utils/command-logger.js)
  Global command logging hook.

- [utils/constants.js](/Users/nnnghia98/Projects/chiateam-bot/bot/utils/constants.js)
  Shared constants.

- [utils/format.js](/Users/nnnghia98/Projects/chiateam-bot/bot/utils/format.js), [utils/validate.js](/Users/nnnghia98/Projects/chiateam-bot/bot/utils/validate.js), [utils/shuffle.js](/Users/nnnghia98/Projects/chiateam-bot/bot/utils/shuffle.js), [utils/team-member.js](/Users/nnnghia98/Projects/chiateam-bot/bot/utils/team-member.js)
  Reusable helpers that should be preferred over command-local copies.

## How To Work In This Folder

- Start from the matching command folder under `commands/` when changing behavior.
- Check [index.js](/Users/nnnghia98/Projects/chiateam-bot/bot/index.js) to see how that command receives state and shared dependencies.
- If a change touches bench/team/vote/cost state, inspect [utils/storage.js](/Users/nnnghia98/Projects/chiateam-bot/bot/utils/storage.js) before editing command code.
- Reuse helpers from `utils/` instead of duplicating formatting, validation, or permission logic.
- Do not add runtime writes to tracked files inside `bot/`. Persisted state belongs in `BOT_STATE_FILE`.
- Do not move next-match data out of `.runtime/bot/storage.json` unless the user explicitly approves that storage change.
