# Bot Command Testing Guide

This document explains how to test the Chiateam Bot locally using the HTTP test server.

## Overview

The bot includes an HTTP test server that runs in development mode, allowing you to send test commands via HTTP requests instead of manually typing them in Telegram. The test script (`test-bot-commands.js`) automates a complete workflow of bot commands.

## How It Works

1. **Test Server**: When running in development mode (`NODE_ENV=development`), the bot starts an HTTP server on port 3001 (configurable via `TEST_SERVER_PORT`)
2. **HTTP Endpoint**: The server exposes `POST /test-command` that accepts command text and simulates a Telegram message
3. **Test Script**: Sends HTTP requests to the test server, simulating a complete bot workflow

## Prerequisites

1. **Environment Variables**: Ensure your `.env.dev` file is configured with:
   - `TELEGRAM_BOT_TOKEN` - Your bot token from BotFather
   - `DATABASE_URL` - PostgreSQL connection string (Supabase cloud)
   - `CHAT_ID` - Target chat ID (optional, will use test chat if not set)
   - `TEST_SERVER_PORT` - Test server port (optional, defaults to 3001)
   - Thread IDs (if using forum/topics): `MAIN_THREAD_ID`, `DEFAULT_THREAD_ID`, etc.

2. **Database**: The bot uses Supabase cloud database. No local database initialization needed.
   - The `yarn init-db` command is only for backup/offline database setup

## Running the Test

### Automated Test Flow

1. **Start the bot in development mode**:

   ```bash
   yarn dev:bot
   ```

   You should see:

   ```
   ✅ Telegram Bot initialized successfully
   ✅ Test server running on http://localhost:3001
   📝 Send test commands to: POST http://localhost:3001/test-command
   🤖 Bot is running...
   ```

2. **Run the automated test script**:

   ```bash
   yarn test:commands
   ```

   The script will automatically check if the test server is available and run through all test steps.

### Manual HTTP Testing

You can also send individual commands using `curl` or any HTTP client:

```bash
# Send a command with default test user
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{"command": "/addme"}'

# Send a command with specific user ID
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{"command": "/bench", "userId": 123456789}'

# Send a command with custom user info
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "/addme",
    "userId": 123456789,
    "userInfo": {
      "first_name": "John",
      "username": "johndoe"
    }
  }'
```

## Test Flow

The script executes the following sequence:

### 1. Add Test User (`/addme`)

- Adds a test user (TestDev) to the bench

### 2. Add Database Players

- Fetches all registered players from the database
- Adds them to the bench in batches (max 10 per command)

### 3. Fill Bench to 15 Players

- Calculates how many more players are needed
- Adds random placeholder players (Player1, Player2, etc.)

### 4. View Bench (`/bench`)

- Displays the current bench list

### 5. Divide Teams (`/chiateam`)

- Randomly divides players into HOME and AWAY teams

### 6. View Teams (`/team`)

- Shows the divided teams

### 7. Set Venue (`/san`)

- Sets venue information with this week's Thursday date
- Format: `19h15 - [dd/mm/yyyy] - sân số 8`

### 8-9. Adjust Teams (`/addtoteam`)

- Adds specific bench players to teams for fine-tuning
- Example: `/addtoteam AWAY 3` (adds 3rd bench player to AWAY)

### 10. Save Match (`/match SAVE`)

- Saves the current match with all players and venue info

### 11. Update Score (`/match [date] 10-12`)

- Updates the match score to HOME: 10, AWAY: 12

### 12. View Matches (`/matches`)

- Lists recent matches

### 13. View Match Detail (`/match`)

- Shows details of the latest match

### 14. Clear Data

- Clears bench with `/clearbench`
- Clears teams with `/clearteam`

## Command Syntax Reference

### Adding Players

```bash
/addme                          # Add yourself
/add Name1, Name2, Name3        # Add multiple players by name
```

### Teams

```bash
/bench                          # View bench
/clearbench                     # Clear bench
/chiateam                       # Divide into 2 teams
/chiateam 3                     # Divide into 3 teams (admin only)
/team                           # View 2 teams
/team 3                         # View 3 teams
/addtoteam HOME 1               # Add bench player #1 to HOME
/addtoteam AWAY 2-5             # Add bench players #2-5 to AWAY
/addtoteam EXTRA "John"         # Add player matching "John" to EXTRA
/clearteam                      # Clear all teams
```

### Venue & Finance

```bash
/san                            # View current venue
/san 19h15 - 28/03/2026 - sân 8 # Set venue
/clearsan                       # Clear venue (admin only)
/tiensan                        # View court fee (default 580K)
/tiensan 600000                 # Set court fee (admin only)
/tiennuoc                       # View water fee (default 60K)
/tiennuoc 70000                 # Set water fee (admin only)
```

### Match Management

```bash
/match                          # View this week's match
/match SAVE                     # Save current match
/match 28/03/2026               # View specific match
/match 28/03/2026 10-12         # Update score
/match 28/03/2026 goal 7 2      # Player #7 scored 2 goals
/match 28/03/2026 assist 10 1   # Player #10 made 1 assist
/match 28/03/2026 mvp 7         # Set player #7 as MVP
/match 28/03/2026 DELETE        # Delete match (admin only)
/matches                        # List recent matches
```

### Statistics

```bash
/leaderboard                    # View leaderboard
/players                        # List all players with stats
/player 7                       # View player #7 details
/update-leaderboard             # Recalculate stats
```

## Customizing the Test

You can modify `test-bot-commands.js` to:

1. **Change test user info**: Edit the `TEST_USER` object
2. **Add more commands**: Add new `simulateCommand()` calls
3. **Adjust delays**: Modify `sleep()` durations if needed
4. **Test specific scenarios**: Comment out steps you don't need

Example:

```javascript
// Skip dividing teams, start from saved match
// await simulateCommand('/chiateam');
// await simulateCommand('/team');
await simulateCommand('/match');
```

## Troubleshooting

### Test server not available

- Make sure the bot is running with `yarn dev:bot`
- Check that `NODE_ENV=development` is set
- Verify the port is not in use (default: 3001)
- Look for "✅ Test server running on http://localhost:3001" in console
- Try changing the port with `TEST_SERVER_PORT=3002` in your `.env.dev`

### Bot not responding

- Check that `TELEGRAM_BOT_TOKEN` is correctly set
- Ensure the bot is not already running (stop other instances)
- Check network connectivity

### Test script connection errors

- Ensure the bot is running first (`yarn dev:bot`)
- Wait for the "Test server running" message before running tests
- Check firewall settings if using custom ports
- Verify `TEST_SERVER_PORT` matches in both bot and test script

### Database errors

- Verify `DATABASE_URL` points to Supabase cloud correctly
- Check Supabase dashboard to ensure database is accessible
- Verify database connection permissions and credentials
- For local/offline backup database: Use `yarn init-db` to initialize tables

### Commands not executing

- Increase sleep delays between commands
- Check console output for error messages
- Verify user permissions (some commands require admin)

### Chat/Thread errors

- If using forum/topics, ensure thread IDs are correct
- Set `CHAT_ID` to your target chat
- Check that the bot has permission to post in the chat

## Manual Testing

For testing specific features not covered by the script:

1. Start the bot in development mode:

   ```bash
   yarn dev:bot
   ```

2. Open Telegram and interact with your bot

3. Use the command reference above

## Advanced: Interactive Commands

Some commands provide interactive buttons/callbacks that can't be fully automated:

- Vote creation and management (`/taovote`)
- Some player selection interfaces
- Admin approval workflows

These should be tested manually in Telegram.

## Tips

- **Reset between tests**: Use `/clearbench` and `/clearteam` to start fresh
- **Database cleanup**: Use `/match [date] DELETE` to remove test matches
- **Check logs**: Monitor console output for errors and command responses
- **Admin commands**: Set your user ID as admin in environment variables if needed

## Environment Variables for Testing

Add to your `.env.dev` file:

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token
DATABASE_URL=postgresql://user:pass@host:5432/dbname  # Supabase cloud connection string

# Optional
NODE_ENV=development
CHAT_ID=your_chat_id
TEST_SERVER_PORT=3001           # Port for HTTP test server (default: 3001)
MAIN_THREAD_ID=your_main_thread
DEFAULT_THREAD_ID=your_default_thread
ANNOUNCEMENT_THREAD_ID=your_announcement_thread
ADMIN_IDS=123456789,234567891
```
