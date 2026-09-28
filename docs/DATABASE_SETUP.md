# Database setup

The API uses PostgreSQL when `DATABASE_URL` is set. The `storage` table is the
primary store for next-match state. The configured `BOT_STATE_FILE` is also
kept as a JSON mirror and fallback.

## Fresh database

For a new, empty Supabase or PostgreSQL project, run
[`api/db/postgres-schema.sql`](../api/db/postgres-schema.sql) once in the SQL
editor. It creates the full schema in one transaction. Do not run this file on
a database that already has these tables: it is a fresh-schema script, not a
migration tool.

## Existing database

Set `DATABASE_URL` in the root `.env`, then run:

```sh
yarn init-db
```

This checks the connection and safely ensures runtime tables, columns, and
indexes with idempotent `IF NOT EXISTS` checks. Run it before starting a new
deployment. It does not replace a planned data migration.

## Hosts and bank accounts

The `host` table stores each person who can receive team payments. Its optional
`player_id` links to `players.id`, so a host may also be a player. A host does
not receive admin access from this link. Several hosts can be active.

The `host_bank_accounts` table stores each host's bank accounts. It keeps the
bank code (`bank_bin`), bank name, account number, account name, and an optional
label. Account numbers are text so leading zeroes remain. Each host may have
several active accounts and at most one default account. A default account
must be active. Both tables are created by the fresh schema or `yarn init-db`.

The admin panel backend exposes `POST /api/hosts` with `displayName` and optional
`playerId`, then `POST /api/hosts/:id/accounts` with `bankBin`, `bankName`,
`accountNumber`, `accountName`, optional `label`, and optional `isDefault`.
These routes require the admin API role. `GET /api/fee-accounts` lists active
accounts for the admin and the Telegram bot.

`fee_batches` stores one fee batch per Vietnam calendar day. `fee_requests`
stores each player's amount, transfer note, and message delivery state. Run
`yarn init-db` after updating the code to add these tables to an existing
database. `/chiatien` previews fees. The private fee delivery command is
temporarily disabled in the bot. The fee batch tables remain ready for a later
release. Payment delivery does not confirm a bank transfer as paid.

## Backups and safety

Before any risky schema or state change:

1. Confirm the target database and environment.
2. Back up PostgreSQL, including `storage` and `current_match`.
3. Back up the JSON file named by `BOT_STATE_FILE`.
4. Test the change, and restore both backups if it causes data loss.

`yarn drop-db` is destructive. Use it only for a confirmed development
database; never use it as a production setup step.

Keep `BOT_STATE_FILE` inside a persistent volume in production (for example,
`/data/bot/storage.json` on Railway).
