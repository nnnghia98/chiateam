# Database setup

The API requires `DATABASE_URL`. PostgreSQL table `storage` is the only
persistent store for next-match state. No JSON file fallback is used.

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

## Backups and safety

Before any risky schema or state change:

1. Confirm the target database and environment.
2. Back up PostgreSQL, including `storage` and `current_match`.
3. Test the change, and restore the database backup if it causes data loss.

`yarn drop-db` is destructive. Use it only for a confirmed development
database; never use it as a production setup step.
