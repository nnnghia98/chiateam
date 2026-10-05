# API and data storage

## API

The API uses Node's built-in `http` module and PostgreSQL via `pg`.

Core endpoints include:

- `GET /healthz`
- `GET /api/status`
- `GET /api/settings`
- `POST /api/settings`
- `GET /api/players`
- `GET /api/players/:number`
- `POST /api/players`
- `PUT /api/players/:number`
- `POST /api/players/:number/avatar`
- `DELETE /api/players/:number`
- `GET /api/matches`
- `GET /api/matches/:date`
- `POST /api/matches`
- `PUT /api/matches/:date`
- `DELETE /api/matches/:date`
- `GET /api/bot-storage`
- `POST /api/bot-storage`
- `POST /api/bot-storage/reset`
- `POST /api/bot-storage/sync`

Admin-only endpoints require:

```text
x-internal-api-auth: <INTERNAL_API_AUTH_TOKEN>
x-admin-role: admin
```

Viewer endpoints accept `x-admin-role: viewer` with the same internal token.
`GET /api/bot-storage` is public and does not require authentication headers.

In production, the API refuses to start unless `INTERNAL_API_AUTH_TOKEN` is set
to a private value. Outside production, it falls back to a public development
token and logs a warning; do not expose that API to a network.

See [HTTP_TEST_EXAMPLES.md](HTTP_TEST_EXAMPLES.md) for sample calls.

## Data storage

Structured data is stored in PostgreSQL, usually Supabase Postgres, through
`DATABASE_URL`.

Main tables:

- `players`
- `matches`
- `match_players`
- `match_player_stats`
- `storage`
- `current_match`

Player avatars are uploaded to Supabase Storage using:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

### Persistent bot state

Next-match state is stored only in PostgreSQL table `storage`. `DATABASE_URL`
is required. Missing configuration logs an error and fails the operation.
Database failures are returned as errors; no local file is used as a fallback.
An empty table returns default state without importing legacy JSON files.
Back up the database before risky storage changes or deployment cutovers.

For fresh setup and migration safety, see [DATABASE_SETUP.md](DATABASE_SETUP.md).
