# Bot state storage

Bot state is stored only in PostgreSQL table `storage`. `DATABASE_URL` is
mandatory on local, Docker, VPS, and Railway API deployments.

The bot calls the API to read, save, and reset next-match players, teams, venue,
fees, and votes. It does not read or write a storage file.

- Missing or blank `DATABASE_URL`: log a clear error and fail the operation.
- Database read or write failure: return an error; never fall back to a file.
- Missing storage row: return default empty state; never import a legacy file.
- Save or reset: update the database only.

The legacy `current_match` table still receives a copy of active vote state for
compatibility. PostgreSQL table `storage` remains the source for bot-state reads.

`BOT_STATE_FILE` and `RAILWAY_VOLUME_MOUNT_PATH` no longer configure bot storage.
Old JSON files, including `bot/storage.json.example`, are archives or examples
only. This change does not delete those files or migrate any live data.

Before risky live-data changes, back up PostgreSQL, including `storage` and
`current_match`. Restore the database backup if needed. See [database setup](DATABASE_SETUP.md).
