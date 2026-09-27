# Sprint 17 - Zalo, Messenger, and Managed Bot Controls

**Period**: September 1-21, 2026
**Area**: Multi-platform delivery, Zalo broadcasts, private routing, and admin controls

## Goals

- Run selected ChiaTeam commands on Zalo and Messenger.
- Let Telegram admins send safe announcements to Zalo subscribers.
- Manage bot settings and command access from the admin panel.
- Improve private-chat and Telegram menu behavior.

## Key Changes

### Zalo adapter and webhook

- Added a Zalo adapter, client, permission policy, formatter, and webhook handler.
- Added Vercel and standalone server entrypoints for Zalo webhooks.
- Added webhook setup, status, test, and delete scripts.
- Added webhook event claims to prevent duplicate event processing.
- Added 2Nike video marker API support.

### Zalo subscriptions and announcements

- Added private `/subscribe` and `/unsubscribe` flows.
- Added `/zalosay` and `/say` for admin announcements from Telegram to Zalo.
- Required a preview and confirmation before broadcast delivery.
- Added delivery records, retry status, subscriber names, and first-contact greetings.
- Added text or image selection and Supabase-backed image storage.

### Messenger MVP

- Added a Messenger webhook, client, adapter, formatter, and permission policy.
- Exposed a limited safe command set: help, polls, votes, vote totals, bench, and teams.
- Kept roster mutation, registration, and admin commands unavailable on Messenger.

### Admin panel controls and private routing

- Added an admin panel backend with versioned settings snapshots.
- Added encrypted secret storage with AES-256-GCM (authenticated encryption).
- Added managed service start, stop, restart, lease, and connection-test support.
- Added per-platform command enable and access rules.
- Added the Telegram reply keyboard generated from the command manifest.
- Kept private command replies in the user's chat while group replies use configured topics.
- Removed the old leaderboard commands and API from the supported product.
- Routed the Telegram vote menu button through the poll flow correctly.

## Product Impact

- Telegram remains the full primary platform.
- Zalo supports a smaller command set and opt-in announcements.
- Messenger has a webhook-based minimum product for attendance and read-only football data.
- Admins can control services, settings, and supported command access from the admin panel.
- One shared command system now defines help, permissions, and platform availability.

## Main Commits

- `08f6d8a` - add the Zalo adapter and webhook
- `081b274` - add Telegram-to-Zalo messaging
- `02bd459` - add the Messenger MVP
- `b3c5cf2` - add opt-in Zalo broadcasts
- `a3726a7` - add Zalo text and image selection
- `dc15a53` - add command controls and the Telegram reply keyboard
- `e5b3087` - add private routing and remove leaderboard features
- `1972298` - route the vote button to the poll command

## Status

- [x] Telegram, Zalo, and Messenger adapters use shared command rules.
- [x] Zalo announcements require subscriber opt-in and admin confirmation.
- [x] The admin panel backend manages settings and service operations.
- [x] Private replies and Telegram reply keyboard behavior are covered by tests.
