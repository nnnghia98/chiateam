# Admin panel settings map

This map is generated from the admin panel settings catalog. Every setting below lives in the dedicated PostgreSQL configuration database, in versioned snapshots. Secret values use AES-256-GCM encryption; the key stays outside that database. A secret removed by an admin stays removed, even if its old environment default still exists.

| Setting | Purpose | Runtime consumers | Stored form | Apply method |
|---|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Controls telegram bot token for the listed services. | telegram | Encrypted secret | restart |
| `BOT_OWNER_ID` | Controls telegram owner id for the listed services. | telegram | Normal value | restart |
| `BOT_ADMIN_IDS` | Controls telegram admin ids for the listed services. | telegram | Normal value | restart |
| `CHAT_ID` | Optional Telegram group destination. Private command replies stay in the sender’s chat. Team polls use this destination when set. Leave empty for source-chat routing. | telegram | Normal value | restart |
| `DEFAULT_THREAD_ID` | Telegram message_thread_id inside CHAT_ID. Used for group routing, not private command replies. Ignored when CHAT_ID is empty. Leave empty for no topic. | telegram | Normal value | restart |
| `MAIN_THREAD_ID` | Telegram message_thread_id inside CHAT_ID. Used for group routing, not private command replies. Ignored when CHAT_ID is empty. Leave empty for no topic. | telegram | Normal value | restart |
| `ANNOUNCEMENT_THREAD_ID` | Telegram message_thread_id inside CHAT_ID. Used for group routing, not private command replies. Ignored when CHAT_ID is empty. Leave empty for no topic. | telegram | Normal value | restart |
| `VIP_THREAD_ID` | Telegram message_thread_id inside CHAT_ID. Used for group routing, not private command replies. Ignored when CHAT_ID is empty. Leave empty for no topic. | telegram | Normal value | restart |
| `STATISTICS_THREAD_ID` | Telegram message_thread_id inside CHAT_ID. Used for group routing, not private command replies. Ignored when CHAT_ID is empty. Leave empty for no topic. | telegram | Normal value | restart |
| `ZALO_BOT_TOKEN` | Controls zalo bot token for the listed services. | zalo-polling, zalo-webhook, telegram | Encrypted secret | restart |
| `ZALO_BOT_OWNER_ID` | Controls zalo owner id for the listed services. | zalo-polling, zalo-webhook | Normal value | restart |
| `ZALO_BOT_ADMIN_IDS` | Controls zalo admin ids for the listed services. | zalo-polling, zalo-webhook | Normal value | restart |
| `ZALO_MODE` | Controls zalo delivery mode for the listed services. | zalo-polling, zalo-webhook | Normal value | restart |
| `ZALO_WEBHOOK_URL` | Controls zalo webhook url for the listed services. | zalo-webhook | Normal value | restart |
| `ZALO_WEBHOOK_SECRET` | Controls zalo webhook secret for the listed services. | zalo-webhook | Encrypted secret | restart |
| `ZALO_GREETING_ENABLED` | Controls greeting enabled for the listed services. | zalo-polling, zalo-webhook | Normal value | restart |
| `ZALO_GREETING_TEXT` | First-contact greeting. Use {name} for the visitor name; leave empty for the default greeting. | zalo-polling, zalo-webhook | Normal value | restart |
| `INTERNAL_API_AUTH_TOKEN` | Controls internal api token for the listed services. | api, admin, telegram, zalo-polling, zalo-webhook | Encrypted secret | restart |
| `DATABASE_URL` | Controls match database url for the listed services. | api | Encrypted secret | restart |
| `SUPABASE_URL` | Controls supabase url for the listed services. | api | Normal value | restart |
| `SUPABASE_SERVICE_ROLE_KEY` | Controls supabase service key for the listed services. | api | Encrypted secret | restart |
| `SUPABASE_STORAGE_BUCKET` | Controls avatar storage bucket for the listed services. | api | Normal value | restart |
| `SUPABASE_ZALO_STORAGE_BUCKET` | Controls zalo image bucket for the listed services. | api | Normal value | restart |
| `GEMINI_API_KEY` | Controls gemini api key for the listed services. | api | Encrypted secret | restart |
| `MAINTENANCE_MODE` | Controls maintenance mode for the listed services. | api, telegram | Normal value | restart |
| `MAINTENANCE_UNTIL` | Controls maintenance end time for the listed services. | api, telegram | Normal value | restart |
| `DEBUG_LOGGING` | Controls debug logging for the listed services. | api | Normal value | restart |
| `ADMIN_UI_URL` | Controls admin ui url for the listed services. | api | Normal value | restart |
| `WEB_UI_URL` | Controls web ui url for the listed services. | api | Normal value | restart |
| `ADMIN_API_URL` | Controls admin api url for the listed services. | admin | Normal value | request |
| `TELEGRAM_API_URL` | Controls telegram api url for the listed services. | telegram | Normal value | restart |
| `ZALO_API_URL` | Controls zalo api url for the listed services. | zalo-polling, zalo-webhook | Normal value | restart |
| `API_PORT` | Controls api port for the listed services. | api | Normal value | deployment |
| `BOT_COMMAND_PREFIX` | Reported by the existing API settings endpoint. Telegram and Zalo slash command names stay unchanged. | api | Normal value | restart |
| `TELEGRAM_COMMAND_RULES` | Controls telegram command rules for the listed services. | telegram | Normal value | restart |
| `ZALO_COMMAND_RULES` | Controls zalo command rules for the listed services. | zalo-polling, zalo-webhook | Normal value | restart |

The admin panel backend also reads active Zalo credentials, API URLs and database credentials for connection tests and explicit administrative operations. These values are never returned to the browser. The Telegram process receives the Zalo token because its existing Zalo announcement sender needs it.

## How changes reach services

- **restart:** Save makes a draft. Apply promotes it. Managed supervisors check every three seconds, stop the old process, then create a new client and database pool. The old child must exit before a replacement starts. API, Telegram and Zalo polling each require a database lease (a time-limited ownership lock). Webhook requests rebuild their application after a version change and prove ownership before outbound work.
- **request:** The Next server resolves its active API address and credential on requests, with a three-second cache. It checks API access before reporting applied. Webhook applications resolve settings per request.
- **deployment:** API_PORT needs a matching Railway port. The page requires hosting confirmation. Code cannot create a Railway volume or change a domain's target port. Database changes also require a backup acknowledgement and a stopped old API before promotion.

All services currently receive the new global version on Apply, so a service may restart even if only another service's field changed. Command names remain defined in code; the page manages only supported enabled/access rules. Existing admin-only commands cannot be made public, and Zalo unsubscribe cannot be disabled.

## Deployment-owned startup and recovery settings

These remain outside the managed store. The admin panel database/key and service credentials must work when the managed data API is unavailable. Existing root .env loading is preserved. Legacy aliases are imported only when the first snapshot is created; use the canonical managed API addresses afterwards.

| Variable | Kind | Reason |
|---|---|---|
| `BOT_API_BASE_URL` | Value | Legacy startup alias. Imported into the three managed API addresses on first setup; edit those addresses afterwards. |
| `API_INTERNAL_URL` | Value | Legacy startup alias. Imported into the three managed API addresses on first setup; edit those addresses afterwards. |
| `API_BASE_URL` | Value | Legacy startup alias. Imported into the three managed API addresses on first setup; edit those addresses afterwards. |
| `API_URL` | Value | Legacy startup alias. Imported into the three managed API addresses on first setup; edit those addresses afterwards. |
| `PORT` | Value | Hosting port alias. API_PORT is the managed value; keep the Railway target port aligned. |
| `UI_API_PORT` | Value | Hosting port alias. API_PORT is the managed value; keep the Railway target port aligned. |
| `MANAGEMENT_DATABASE_URL` | Secret | Keeps recovery available when the match database changes. |
| `MANAGEMENT_ENCRYPTION_KEY` | Secret | Keep this key outside the configuration database. |
| `MANAGEMENT_ADMIN_TOKEN` | Secret | Only the admin panel web app may use this credential. |
| `MANAGEMENT_API_TOKEN` | Secret | Separate service credential; never reuse another service token. |
| `MANAGEMENT_TELEGRAM_TOKEN` | Secret | Separate credential for the Telegram service and its Zalo announcement sender. |
| `MANAGEMENT_ZALO_POLLING_TOKEN` | Secret | Separate credential for the polling process. |
| `MANAGEMENT_ZALO_WEBHOOK_TOKEN` | Secret | Separate credential for the webhook service. |
| `MANAGEMENT_ADMIN_SERVICE_TOKEN` | Secret | Reads only the admin API connection. |
| `MANAGEMENT_API_URL` | Value | Stable admin panel backend URL on Railway. |
| `MANAGEMENT_ALLOWED_ORIGINS` | Value | Explicit origin allowlist, including local development when needed. |
| `MANAGEMENT_ALLOWED_DATABASE_HOSTS` | Value | Restricts where candidate database credentials may be sent. |
| `MANAGEMENT_PORT` | Value | Railway must route the admin panel backend domain to this port. |
| `ZALO_WEBHOOK_PORT` | Value | Railway domain target port for the webhook service. |
| `MANAGEMENT_BOOTSTRAP` | Value | Enable after the separate admin panel backend is ready. |
| `NODE_ENV` | Value | Uses one root .env; never selects another file. |
| `ADMIN_PASSWORD` | Secret | Set in the admin panel web app environment, not the bot/backend .env. Used for login recovery. |
| `ADMIN_SESSION_SECRET` | Secret | Set in the admin panel web app environment, not the bot/backend .env. Changing it signs out existing sessions. |
| `BOT_CONTROLS_LEGACY_API` | Value | Deployment-only migration switch; keep disabled for managed services. |
| `MESSENGER_PAGE_ID` | Value | Messenger remains deployment managed; this page manages Telegram and Zalo. |
| `MESSENGER_PAGE_ACCESS_TOKEN` | Secret | Messenger remains deployment managed; this page manages Telegram and Zalo. |
| `MESSENGER_APP_SECRET` | Secret | Messenger remains deployment managed; this page manages Telegram and Zalo. |
| `MESSENGER_VERIFY_TOKEN` | Secret | Messenger remains deployment managed; this page manages Telegram and Zalo. |
| `MESSENGER_GRAPH_API_VERSION` | Value | Messenger remains deployment managed; this page manages Telegram and Zalo. |
| `MESSENGER_ADMIN_IDS` | Value | Messenger remains deployment managed; this page manages Telegram and Zalo. |

Platform command pause and last-command activity remain in the existing bot-controls data store. Subscriber choices, announcement drafts and delivery records remain in the existing match database tables. Match storage uses PostgreSQL only. Messenger remains deployment-managed because this page controls Telegram and Zalo.
