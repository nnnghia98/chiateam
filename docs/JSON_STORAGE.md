# Bot Storage System for Data Persistence

## Overview

The API stores next-match roster and team state in PostgreSQL table `storage`
when `DATABASE_URL` is configured. It also mirrors the same payload to a JSON
file so local file-only development still works and production keeps a simple
backup artifact.

The default local/VPS JSON mirror is `/api/data/bot/storage.json`. You can
override it with `BOT_STATE_FILE`.

On Railway, set `BOT_STATE_FILE` to a path inside the mounted volume. For the
current `/data` mount, use `/data/bot/storage.json`. If `BOT_STATE_FILE` is not
set and Railway provides `RAILWAY_VOLUME_MOUNT_PATH`, the API falls back to
`${RAILWAY_VOLUME_MOUNT_PATH}/bot/storage.json`.

`activeVote` is stored in the `storage` table with the rest of the payload. It
is still mirrored into the legacy PostgreSQL `current_match` table during the
transition.

Before risky implementation or deployment work, back up both the `storage` table
and the JSON mirror so they can be restored if needed.

## Persisted Data

The following data is now saved to disk:

1. **bench** - Players who joined using `/addme` (the bench/roster)
2. **teamA** - Home team (2-team split)
3. **teamB** - Away team (2-team split)
4. **team3A** - Team A (3-team split)
5. **team3B** - Team B (3-team split)
6. **team3C** - Team C/Extra (3-team split)
7. **manifest** - Current same-team and different-team constraints
8. **san** - Current venue
9. **tiensan** - Field rental cost
10. **tiennuoc** - Water cost
11. **teamThua** - Which team lost the match
12. **activeVote** - Current Telegram poll/vote state

World Cup predictions are not stored in this JSON file. They are stored in PostgreSQL tables documented in [WORLD_CUP_PREDICTIONS_API.md](./WORLD_CUP_PREDICTIONS_API.md).

## File Structure

```json
{
  "bench": [[userId, playerData], ...],
  "teamA": [[userId, playerData], ...],
  "teamB": [[userId, playerData], ...],
  "team3A": [[userId, playerData], ...],
  "team3B": [[userId, playerData], ...],
  "team3C": [[userId, playerData], ...],
  "manifest": null,
  "san": "Sân số 8" | null,
  "tiensan": 0,
  "tiennuoc": 0,
  "teamThua": "HOME" | "AWAY" | null,
  "activeVote": null,
  "lastUpdated": "2026-03-28T10:30:00.000Z"
}
```

## Database Structure

The PostgreSQL table is a singleton table named `storage`. It has one row
(`id = 1`) and nullable columns matching the JSON payload fields:

```sql
CREATE TABLE IF NOT EXISTS storage (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  bench JSONB,
  "teamA" JSONB,
  "teamB" JSONB,
  "team3A" JSONB,
  "team3B" JSONB,
  "team3C" JSONB,
  manifest JSONB,
  san TEXT,
  tiensan INTEGER,
  tiennuoc INTEGER,
  "teamThua" TEXT,
  "activeVote" JSONB,
  "lastUpdated" TEXT
);
```

### Map Storage Format

JavaScript Maps are stored as arrays of `[key, value]` pairs:

- **userId**: Telegram user ID or synthetic ID
- **playerData**: Object containing player information (name, username, etc.)

Example:

```json
"bench": [
  [123456789, "John (@john_doe)"],
  [987654321, "Jane (@jane_doe)"]
]
```

## Auto-Save Behavior

The storage system automatically saves to disk whenever:

- A player is added/removed from bench
- A team is modified (player added/removed)
- The venue (san) is updated
- Field cost (tiensan) is updated
- Water cost (tiennuoc) is updated
- Team loss status (teamThua) is changed
- Poll state (activeVote) is changed

## Files

- **`bot/utils/storage.js`** - Storage utility functions
- **`api/services/bot-storage-service.js`** - API service that reads/writes the `storage` table and JSON mirror
- **`/api/data/bot/storage.json`** - Default local/VPS JSON mirror (auto-generated, gitignored)
- **`/data/bot/storage.json`** - Railway JSON mirror when the volume is mounted at `/data`
- **`bot/storage.json.example`** - Example data structure

## Usage in Code

The storage system is initialized in `bot/index.js`:

```javascript
const { initializeStorage } = require('./utils/storage');

// Initialize persistent storage
const storage = initializeStorage();
const { bench: members, teamA, teamB, team3A, team3B, team3C } = storage;

// Use getter/setter functions for primitive values
const getTiensan = storage.getTiensan;
const setTiensan = storage.setTiensan;
const getSan = storage.getSan;
const setSan = storage.setSan;
```

### Working with Maps

Maps work exactly as before, but automatically persist:

```javascript
// Add player to bench (auto-saves)
members.set(userId, playerData);

// Remove player from bench (auto-saves)
members.delete(userId);

// Clear team (auto-saves)
teamA.clear();
```

### Working with Primitive Values

Use getter/setter functions:

```javascript
// Get current value
const currentCost = getTiensan();
const currentVenue = getSan();

// Update value (auto-saves)
setTiensan(600000);
setSan('Sân số 8');
```

## Runtime Behavior

The bot will automatically:

1. Ask the API for runtime storage on startup
2. Read from PostgreSQL table `storage` when `DATABASE_URL` is configured
3. Seed an empty `storage` table from the JSON mirror on first DB-backed read
4. Use the JSON mirror directly when no `DATABASE_URL` is configured
5. Use default values if neither source has data yet
6. Update both the DB row and JSON mirror on each save

Run `yarn init-db` before deployment to ensure the table exists. If a JSON
mirror already has data, no manual migration script is required: the first
DB-backed read seeds the table from the file.

## Testing

To test persistence:

1. Start the bot
2. Run `/addme` to add yourself
3. Stop the bot
4. Check that the runtime storage file was created
5. Restart the bot
6. Run `/bench` - you should still see yourself in the list

## Troubleshooting

### Data not persisting

Check that:

- `yarn init-db` has been run against the target database
- The `storage` table has a row with `id = 1` after the first API read/write
- The bot has write permissions to the configured storage directory
- Railway `BOT_STATE_FILE` points inside the volume mount, for example `/data/bot/storage.json`
- No errors in console logs when saving
- The configured storage file exists and is valid JSON

### Corrupted storage.json

1. Stop the bot
2. Restore the `storage` table from backup if production DB state is affected
3. Restore the JSON mirror from backup if the file is affected
4. If no JSON backup exists, optionally copy `bot/storage.json.example` to the configured storage path
5. Restart the bot

### Manual data editing

You can manually edit the runtime storage file while the bot is stopped:

- Ensure valid JSON format
- Use proper array format for Map data: `[[key, value], ...]`
- Restart the bot to load changes

If the file is being changed for implementation or deployment work, make a backup first so the persistent next-match state can be restored exactly.
