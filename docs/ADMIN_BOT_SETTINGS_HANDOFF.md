# Admin Team Handoff: Telegram and Zalo Status and Settings

Date: 2026-09-10
Status: ready for the admin team; implementation has not started.

## Request and Priority

Build bot status and settings in the existing `chiateam-admin` panel. The owner
selected this work ahead of Messenger. The owner requested a handoff only in
this task; do not treat this document as completed implementation.

- Focus on Telegram and Zalo.
- Keep Messenger production setup deferred.
- Keep payment announcements and manual confirmation as Phase 9, the final
  planned feature. Payment controls are outside this UI delivery.
- Reuse the current admin site, its login, styles, and API connection.

## Projects and Entry Points

The admin repository is `../chiateam-admin`, next to this bot repository.
Read each repository's `AGENTS.md` before making changes. Do not commit or push
unless instructed; both repositories prohibit pushing.

Admin files to inspect:

- `src/components/navigation.tsx` — desktop and mobile navigation.
- `src/components/client-layout.tsx` — shared layout and session loading.
- `src/contexts/auth-context.tsx` — viewer and admin access.
- `src/lib/api-client.ts` — browser requests through the admin server.
- `src/app/api/proxy/[...path]/route.ts` — server-side API forwarding and access
  checks. The browser must not receive the internal API token.
- `src/lib/i18n.ts` — English and Vietnamese text.
- `src/app/next-match/page.tsx` — existing match and fee controls to preserve.
- `tests/proxy-permissions.test.mjs` and `tests/bot-storage.test.mjs` — existing
  access and storage checks.

Bot/API files to inspect:

- `api/routes/server.js` — API (the interface used by the admin site), status,
  settings, access checks, and maintenance rules.
- `api/index.js` — API process status.
- `runtime/start-bot.js` and `runtime/start-zalo-bot.js` — bot runtime setup.
- `core/commands/command-router.js` — shared command execution.
- `runtime/create-zalo-webhook-application.js` — Zalo webhook setup (receiving
  events sent by Zalo).
- `bot/index.js`, `bot/zalo-index.js`, and `config/maintenance.js` — process
  startup and current maintenance behavior.

## Verified Current Behavior

| Existing endpoint or setting | Actual behavior | UI implication |
| --- | --- | --- |
| `GET /api/status` | Public API-process status; `online: true` means the API answered | Do not label Telegram or Zalo online from this value |
| `GET /api/settings` | Requires trusted internal authentication and viewer/admin role | This is not a bot health endpoint |
| `POST /api/settings` | Requires admin role; changes an in-memory API object | Changes are lost when that API process restarts |
| `maintenanceMode` | Blocks many API routes; bot startup reads its own environment setting | Do not describe it as a reliable per-platform pause switch |
| `debugLogging`, `botCommandPrefix`, `allowedChatIds` | Stored by the API but have no bot-runtime consumers | Do not present them as working bot controls |
| `MAINTENANCE_MODE=true` | Locks the API maintenance setting; POST returns `409` | A future maintenance form must show the lock and handle this response |

Telegram, Zalo, and the API run separately. Token presence in the API process
does not prove that a separately deployed bot is configured or connected.
There is no shared bot activity/status record today.

Browser check on 2026-09-10: `http://localhost:8389/` loads the existing admin
layout in viewer mode. It shows “Dashboard data could not be loaded.” The
cause was not investigated in this handoff. Check the local API connection
before end-to-end testing; do not treat displayed zero counts as real data.

## Recommended First Delivery

Add an admin-only `/bots` page and a “Bots” navigation item. Keep the current
light/dark styles, mobile navigation, and English/Vietnamese support.

The page should show:

1. API availability and the time of the last successful refresh.
2. One section each for Telegram and Zalo.
3. Whether commands are enabled or paused for each platform.
4. Last recorded command activity and delivery mode, when available.
5. A separate “Accept commands” control and Save/Cancel actions for each
   platform. These require the backend work below before release.

Suggested page structure:

```text
Bots                                      Refresh
Manage Telegram and Zalo

API: Available / Unavailable               Last checked: ...

Telegram
Commands: Enabled / Paused
Last command: ... / No activity recorded
Accept commands                           [switch]
                                          Cancel   Save changes

Zalo
Commands: Enabled / Paused
Last command: ... / No activity recorded
Accept commands                           [switch]
                                          Cancel   Save changes
```

Use “Last command received” instead of “Online.” Recent activity does not prove
that a bot is still connected. No recorded activity does not prove it is offline.
Show unknown or unavailable states directly. Never replace failed requests with
success badges or demo values.

## Backend Work Required Before Controls Can Ship

The following is a proposed contract, not an existing API. The admin team and
bot/API owner must agree on the final contract before integration.

| Proposed endpoint | Purpose | Access |
| --- | --- | --- |
| `GET /api/bot-controls` | Return settings and recorded activity for Telegram/Zalo | Admin only |
| `POST /api/bot-controls/:platform` | Save `{ "commandsEnabled": true/false }` for one platform | Admin only |
| `POST /api/bot-controls/:platform/check` | Runtime checks whether a command may run and records activity | Trusted bot service only; never exposed to browser callers |

Suggested platform result fields:

- `platform`: `telegram` or `zalo`.
- `commandsEnabled`: boolean.
- `lastCommandAt`: server-recorded timestamp or `null`.
- `mode`: `polling`, `webhook`, or `null` (how that runtime receives events).
- `updatedAt`: settings update timestamp or `null`.

Use `{ "platforms": [...] }` for the GET response and one platform object for
save/check responses. Keep activity and settings-update timestamps separate.

Implementation requirements:

- Store controls separately in a private PostgreSQL table. Keep the API as
  the only writer. Defaults should preserve the existing enabled behavior.
- Wire the setting into the real Telegram and Zalo command paths, including
  command buttons and pending text replies. A setting saved only by the API
  is not complete.
- Define the pause scope clearly: the suggested switch pauses commands only.
  Existing native poll answers and outgoing broadcasts are separate flows.
  Keep Zalo `/unsubscribe` usable while commands are paused. Ensure the UI
  wording matches the final implementation.
- Decide what happens when the settings API is unavailable, and test it.
  Do not silently ignore saved pauses or break deployment to older API versions.
- Return only safe fields. Do not send tokens, raw errors, environment values,
  or private conversation/user IDs to the page.
- Protect reads and writes at the API and admin-server layers. Do not forward
  browser requests to the runtime-only check route. An admin page refresh must
  never update the last bot activity time.
- Keep control endpoints reachable during maintenance, with authentication
  still enforced, so authorized admins can inspect and recover the service.
- Reject unknown platforms, extra fields, and invalid values. Use atomic
  updates so changing Telegram cannot overwrite Zalo settings.
- Disable caching for control/status responses. Use bounded requests and
  clear errors. Use test-only data for development; do not change live settings.

Do not write to `.env` from the UI. Keep next-match data in PostgreSQL `storage`
and the configured JSON mirror. `/reset` must not erase bot controls. No
football-storage migration is required for this page.

## UI States and Acceptance Checks

- [ ] Viewer users cannot see admin controls or retrieve private status data.
- [ ] Direct navigation to `/bots` handles loading and login clearly.
- [ ] The page distinguishes API availability, command settings, and activity.
- [ ] API errors keep previous data visibly stale or unavailable, never online.
- [ ] Save writes only the selected platform and reports real success/failure.
- [ ] Save is disabled until valid data loads; repeated clicks do not duplicate
      requests. Refresh does not erase unsaved changes without notice.
- [ ] Cancel restores the last saved value. Failed saves preserve the draft.
- [ ] Logout or navigation prevents stale responses from restoring private UI.
- [ ] Settings survive API restart and take effect in both bot runtimes.
- [ ] Paused commands, buttons, text replies, and Zalo unsubscribe behave as
      described. Activity timestamps come from the runtime, not the UI.
- [ ] Keyboard use, focus, labels, status messages, mobile layout, and both
      themes/languages work.
- [ ] Existing next-match edits and other admin pages keep working.

Verification: run the existing admin tests, TypeScript check, and production
build, plus targeted API and runtime tests for the new controls. Use the owner's
existing development servers for browser checks. Confirm behavior with test
bots/accounts before a production release.

## Delivery Order

1. Agree on the status/control contract and exact pause behavior.
2. Implement the private API store and real runtime checks with tests.
3. Build the admin page and connect it to the tested contract.
4. Check access, save errors, restart behavior, and desktop/mobile UI.
5. Deploy compatible API and runtime changes before making UI controls usable.
6. Record completed local checks and owner live checks separately in the
   [migration plan](MULTI_PLATFORM_BOT_PLAN.md).

Current handoff result: repository/API review and a read-only browser check are
complete. No admin, bot-runtime, or API implementation changes were made.
