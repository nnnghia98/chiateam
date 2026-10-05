# Configuration

Every environment owns one root `.env` file with its own values. Runtime
commands always load `.env`; they do not select environment-suffixed
files. `NODE_ENV` may still identify development or production behavior, but it
does not change which env file is loaded.

`yarn setup` creates the file safely. To create it manually instead, run:

```bash
cp .env.example .env
```

Both files use two main sections:

| Section | Settings                                                                                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BOT`   | Telegram credentials and group topics; Zalo credentials and webhook; Messenger webhook credentials.                                                      |
| `API`   | API connection and shared authentication; required database; image storage; allowed web origins; maintenance; optional AI; admin panel backend settings. |

Use [.env.example](../.env.example) for the current setting names and comments.
Shared settings appear once. `NODE_ENV`, `INTERNAL_API_AUTH_TOKEN`, and
maintenance settings under `API` are also used by bot services. Optional
feature settings stay in the example even when that feature is not enabled.

Payment receiver details are stored in `host` and `host_bank_accounts` in
PostgreSQL. The admin panel backend provides `POST /api/hosts` and
`POST /api/hosts/:id/accounts` to add them. See
[DATABASE_SETUP.md](DATABASE_SETUP.md). Private fee delivery is
temporarily disabled in the bot.

`BOT_API_BASE_URL` is the main bot-to-API address. `API_INTERNAL_URL` remains
a supported fallback and can also seed the first admin panel settings import.
`WEB_UI_URL` and `ADMIN_UI_URL` both add allowed web origins and may have
different values.

Do not put `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, or `VIEWER_PASSWORD` in
this repository's `.env`. The admin panel web app has its own environment and
login settings. `ENV_FILE` is ignored and is not needed. Set the Messenger
callback URL directly in Meta settings; the code does not read a
`MESSENGER_WEBHOOK_URL` variable.

`INTERNAL_API_AUTH_TOKEN` must be a private random value in production. The API
refuses to start in production with it missing or set to a public example value.

`GEMINI_API_KEY` is optional. When present, match flows can generate Vietnamese
AI commentary. When absent, AI helpers return `null` and normal match behavior
continues.

## Maintenance mode

Set these in the active env file to pause bot/API traffic for the environment:

```text
MAINTENANCE_MODE=true
MAINTENANCE_UNTIL=2026-10-02 12:00
```

The bot responds to commands with a maintenance message. The API keeps health,
status, and settings routes available while maintenance mode is enabled.

## Database checks

Verify the configured database connection and ensure runtime helper columns and
tables exist:

```bash
yarn init-db
```

For a fresh database, apply `api/db/postgres-schema.sql` before this command.
See [DATABASE_SETUP.md](DATABASE_SETUP.md) for fresh setup, existing database
checks, and backup rules.

Drop scripts exist for development cleanup, but they are destructive:

```bash
yarn drop-db
```

Do not run destructive database commands against production unless the target
environment and backup plan are confirmed.
