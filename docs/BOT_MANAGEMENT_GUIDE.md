# Admin panel setup and recovery

The `/bots` page now manages Telegram, Zalo, API connections and shared settings. It keeps the existing admin login and English/Vietnamese interface. The settings store is separate from match data. Implementation tests use fake services; nothing has been deployed or sent to real subscribers.

## Railway services

Use a separate admin panel backend (the server that handles admin panel requests). Its database and URL must stay available while the match API restarts. Use different random values for every admin panel token. Reused tokens are rejected. Do not expose runtime or admin panel tokens to browser environment variables.

| Service | Start command in bot repo | Required startup settings |
|---|---|---|
| Admin panel backend | `yarn start:admin` | `MANAGEMENT_DATABASE_URL`, `MANAGEMENT_ENCRYPTION_KEY`, `MANAGEMENT_ADMIN_TOKEN`, and all five service tokens |
| Data API | `yarn start:api` | `MANAGEMENT_BOOTSTRAP=true`, the same stable `MANAGEMENT_DATABASE_URL` and encryption key; the parent reads this store directly |
| Telegram | `yarn start:bot` | `MANAGEMENT_BOOTSTRAP=true`, `MANAGEMENT_API_URL`, `MANAGEMENT_TELEGRAM_TOKEN` |
| Zalo polling | `yarn start:zalo` | `MANAGEMENT_BOOTSTRAP=true`, `MANAGEMENT_API_URL`, `MANAGEMENT_ZALO_POLLING_TOKEN` |
| Zalo webhook | `yarn start:zalo-webhook` | `MANAGEMENT_BOOTSTRAP=true`, `MANAGEMENT_API_URL`, `MANAGEMENT_ZALO_WEBHOOK_TOKEN` |
| Admin panel web app | Existing admin start command | `MANAGEMENT_API_URL`, `MANAGEMENT_ADMIN_TOKEN`, `MANAGEMENT_ADMIN_SERVICE_TOKEN`, `MANAGEMENT_ALLOWED_ORIGINS`; keep `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` |

The admin panel backend's full service-token set is `MANAGEMENT_API_TOKEN`, `MANAGEMENT_TELEGRAM_TOKEN`, `MANAGEMENT_ZALO_POLLING_TOKEN`, `MANAGEMENT_ZALO_WEBHOOK_TOKEN`, and `MANAGEMENT_ADMIN_SERVICE_TOKEN`. The API parent uses the stable store directly; its HTTP token is available for separately authenticated API runtime calls. Each child receives only its actual runtime settings and its own service credential. Bootstrap encryption keys and unrelated service tokens do not enter child environments.

The `.env.example` leaves managed startup **off**. Enable it explicitly only after the admin panel backend is ready. Stop old unmanaged receiver deployments when moving to this setup. An unmanaged process does not take part in leases or restart control.

The root `.env` and `.env.example` use `BOT` and `API` sections. Keep
`MANAGEMENT_*` settings under `API`, including tokens shared with bot services.
The admin panel web app reads its own environment. Its `ADMIN_PASSWORD` and
`ADMIN_SESSION_SECRET` do not belong in this backend's `.env`.

### Startup errors

`yarn start:admin` loads the root `.env`. If startup reports
`MANAGEMENT_ENCRYPTION_KEY_REQUIRED`, the key is missing or does not decode to
32 bytes. The example value in `.env.example` is a placeholder. For a new
admin panel settings store, generate a random 32-byte key encoded as base64 and save it
in `.env`. If saved admin panel settings already exist, restore their original
key instead. A new key cannot read secrets saved with a different key.

Keep all six admin panel access tokens present and distinct. Missing or reused
tokens cause protected requests to fail even when the server starts. The
admin panel backend falls back to `DATABASE_URL` if `MANAGEMENT_DATABASE_URL` is
unset; use a stable admin panel database connection for the deployment described below.
The ready message confirms that the server is listening, not that its database
connection has been tested.

### First setup

1. Provision a stable PostgreSQL configuration database. Set `MANAGEMENT_DATABASE_URL` independently of the match `DATABASE_URL`. The service creates only its `management_snapshots` table in this database.
2. Generate a 32-byte random encryption key, encoded as base64. Keep it in Railway secrets and an external recovery backup. Set a separate random token for each service listed above.
3. Set existing bot/API defaults on the admin panel backend for the **first** start. It imports them into snapshot zero. Later changes to those environment defaults do not replace saved settings or removed secrets.
4. Set `MANAGEMENT_ALLOWED_ORIGINS` on the admin panel backend and web app to the exact API and Supabase **destination origins** that may receive credentials. For example, list the approved private API origin, the Supabase project origin, and explicit localhost origins only for development. This is not the browser CORS list; `ADMIN_UI_URL` and `WEB_UI_URL` control API CORS separately.
5. Set `MANAGEMENT_ALLOWED_DATABASE_HOSTS` before testing a replacement database. The default allows only the initial data/config database hosts. Production admin panel database connections use certificate-checked TLS; provide the required CA through `NODE_EXTRA_CA_CERTS` if your database needs it.
6. Start the admin panel backend, then enable managed startup on API and bot workers. Start with one replica per worker. The API and pollers use leases to prevent competing active children across replicas.
7. Connect the admin panel web app to the stable backend URL. Open `/bots`, test credentials, and check each service's applied version. The admin panel login and settings page remain reachable if the data API fails.

Railway private service URLs can connect services in the same project/environment. Configure the real private hostname and port; examples are not deployable values. See [Railway private networking](https://docs.railway.com/networking/private-networking).

### Ports and files

- The admin panel backend listens on `MANAGEMENT_PORT`, then `PORT`, then 8790. Its health path is `/health`.
- Data API uses managed `API_PORT`; first import also supports the existing hosting aliases. Keep Railway's target port aligned. Confirm the hosting change in the page before Apply.
- The Zalo webhook server uses `ZALO_WEBHOOK_PORT`, then `PORT`, then 8791. Its public receiver is `/webhook/zalo`, and health path is `/health`.
- Set the required `DATABASE_URL` on the API service. Bot state needs no file volume.

Railway's domain target port must match the service listener. See [Railway domains and ports](https://docs.railway.com/networking/domains/working-with-domains).

## Save, test, apply and recovery

Save creates an encrypted versioned draft. It does not change active workers. Every save uses the current version, so concurrent admins cannot silently overwrite each other. Secret fields support Keep existing, Replace and Remove. The server returns only configured status and safe metadata. Change history contains the action, time, setting names and a hashed admin-session identifier, not secret values. The shared-password login cannot identify a named person.

Tests use fixed provider endpoints or explicitly approved API/database destinations. Tests do not send messages or register webhooks. Token and connection changes are checked before saving and again before Apply where possible. Removal is explicit and does not require a working old credential.

Apply promotes a candidate after checks. Supervisors stop the prior child, create fresh clients, then wait for readiness. Failed preflight checks leave the active version unchanged. If a child fails after promotion, the supervisor attempts to restart its prior working environment and reports failed; the active version remains the candidate, while the applied version shows the actual process. Use Rollback to restore the prior active snapshot. The page keeps saved, active and per-service applied versions separate.

API token rotation can validate the old credential on an unchanged endpoint before restart. The new API reports ready with its new settings; the admin panel web app tests the new connection before reporting applied. The separate admin panel backend endpoint remains available throughout. A changed API destination must pass the candidate credential check before promotion.

### Database changes

Before Apply or Rollback across storage settings, make a real backup of the match database, then check the backup box. The code records your confirmation; it does not create a backup or copy data between databases. Prepare and verify the destination schema and data separately. Existing matches, players, polls, subscriptions and announcement records must already be present at the destination.

Storage changes drain admin panel operations, request API and receivers to stop, and wait for the old API's stopped report and live leases to end. The active database is not promoted until then. If this takes longer than one request, the page reports `STORAGE_QUIESCE_PENDING`: inspect service states and retry Apply. Data operations remain paused. After promotion, they resume only when the new API reports applied. Restart and further saves are blocked while this transition is pending. Rollback can recover a failed promoted storage version and uses the same stop-before-switch process.

If the admin panel settings store or encryption key is lost, restore the correct database backup and matching key through Railway. A new unrelated key cannot decrypt old snapshots. Do not delete snapshots or replace the key as a normal restart step.

## Webhooks, subscribers and announcements

For polling to webhook: save/test/apply the webhook URL, secret and mode; then confirm Register. Register drains the previous receiver before calling the provider. For webhook to polling: confirm Remove first, then save/test/apply polling mode. The service checks provider webhook state and refuses a conflicting switch. Runtime leases block overlapping Zalo receivers, and webhook outbound calls recheck ownership.

Subscribers are listed with their subscription status. Removing a subscriber opts them out; it does not force them back in. `/unsubscribe` stays available while commands are paused. Announcements use the existing draft, claim and delivery records. Create preview, check message/photo and recipient count, then confirm Send. Each request handles one recipient, and the UI continues up to 50 deliveries per confirmation. Uncertain delivery stops automatic continuation so it can be checked before retrying. No real sends are part of implementation verification.

See [the complete settings map](BOT_MANAGEMENT_SETTINGS_MAP.md) for every managed and deployment-owned value.

## Verification on 2026-09-12

- Bot suite: 610 tests, 607 passed, 3 existing database tests skipped.
- Admin suite: 30 passed. Type check and isolated production build passed.
- Fake services cover secret handling, admin restrictions, candidate checks, version conflicts, token/client changes, restart leases, storage stop-before-switch and rollback, database removal, command rules and unsubscribe, webhook fencing, expired announcement drafts and uncertain delivery.
- Browser checks confirmed the desktop form, Vietnamese translation, unsaved input across a language change, and no horizontal overflow at a 390-pixel viewport. The browser tool became unresponsive during the save-confirmation check, so that final browser flow was not completed.
- Temporary test servers were stopped. No production tokens, provider registrations, database migrations, deployment, messages, commits or pushes were performed.

Use Node.js 22 or newer for these services. Production credentials, Railway networking, database permissions and live provider behavior still need verification during deployment.
