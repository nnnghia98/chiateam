# JSON Storage System for Bot Data Persistence

## Overview

The bot now uses a JSON file (`bot/data.json`) to persist data across server restarts. Previously, all data was stored in memory and would be lost when the server restarted.

## Persisted Data

The following data is now saved to disk:

1. **bench** - Players who joined using `/addme` (the bench/roster)
2. **teamA** - Home team (2-team split)
3. **teamB** - Away team (2-team split)
4. **team3A** - Team A (3-team split)
5. **team3B** - Team B (3-team split)
6. **team3C** - Team C/Extra (3-team split)
7. **tiensan** - Field rental cost (default: 580000)
8. **tiennuoc** - Water cost (default: 60000)
9. **teamThua** - Which team lost the match

## File Structure

The data is stored in `bot/data.json` with the following structure:

```json
{
  "bench": [[userId, playerData], ...],
  "teamA": [[userId, playerData], ...],
  "teamB": [[userId, playerData], ...],
  "team3A": [[userId, playerData], ...],
  "team3B": [[userId, playerData], ...],
  "team3C": [[userId, playerData], ...],
  "tiensan": 580000,
  "tiennuoc": 60000,
  "teamThua": "HOME" | "AWAY" | null,
  "lastUpdated": "2026-03-28T10:30:00.000Z"
}
```

### Map Storage Format

JavaScript Maps are stored as arrays of `[key, value]` pairs:

- **userId**: Telegram user ID or synthetic ID
- **playerData**: Object containing player information (name, username, etc.)

Example:

```json
"bench": [
  [123456789, "John (@john_doe)"],
  [234567891, "Jane (@jane_doe)"]
]
```

## Auto-Save Behavior

The storage system automatically saves to disk whenever:

- A player is added/removed from bench
- A team is modified (player added/removed)
- Field cost (tiensan) is updated
- Water cost (tiennuoc) is updated
- Team loss status (teamThua) is changed

## Files

- **`bot/utils/storage.js`** - Storage utility functions
- **`bot/data.json`** - Runtime data (auto-generated, gitignored)
- **`bot/data.json.example`** - Example data structure

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

// Update value (auto-saves)
setTiensan(600000);
```

## Migration from In-Memory Storage

The bot will automatically:

1. Look for existing `bot/data.json` on startup
2. Load data if found
3. Use default values if not found
4. Create the file on first data change

No migration script is needed. Just restart the bot and use it normally.

## Testing

To test persistence:

1. Start the bot
2. Run `/addme` to add yourself
3. Stop the bot
4. Check that `bot/data.json` was created
5. Restart the bot
6. Run `/bench` - you should still see yourself in the list

## Troubleshooting

### Data not persisting

Check that:

- The bot has write permissions in the `bot/` directory
- No errors in console logs when saving
- The `bot/data.json` file exists and is valid JSON

### Corrupted data.json

1. Stop the bot
2. Delete `bot/data.json`
3. Optionally copy `bot/data.json.example` to `bot/data.json`
4. Restart the bot

### Manual data editing

You can manually edit `bot/data.json` while the bot is stopped:

- Ensure valid JSON format
- Use proper array format for Map data: `[[key, value], ...]`
- Restart the bot to load changes
