# My Telegram Bot

A Telegram bot for team management and organization.

## Environments

- **Production**: `/chiateam`
- **Development**: `/chiateam-dev`

## Git Flow

1. Checkout new branch from main:

   ```bash
   git checkout -b abcxyz/dev
   ```

2. Work within `/chiateam-dev` directory

3. Create Pull Request: `abcxyz/dev` → `main` (no delete merged branch)

4. Keep working on `abcxyz/dev` branch

## Development Workflow

- All development work should be done in the `/chiateam-dev` directory
- Production code is in the `/chiateam` directory
- Use feature branches for development
- Keep the development branch active for ongoing work

## Testing

### HTTP Test Server (Development Mode)

The bot includes an HTTP test server for development that allows sending commands via HTTP requests instead of manually typing them in Telegram.

**Start the bot in development mode**:

```bash
yarn dev:bot
```

The test server will automatically start on port 3001 (configurable via `TEST_SERVER_PORT`).

### Automated Test Flow

Run the complete automated test workflow:

```bash
yarn test:commands
```

This script will:

1. Connect to the HTTP test server
2. Run through a complete workflow including:
   - Add test user with `/addme`
   - Add all players from database
   - Add random players to bench (up to 15 total)
   - Check bench with `/bench`
   - Divide teams with `/chiateam`
   - View teams with `/team`
   - Set venue with `/san 19h15 - [this thursday] - sân số 8`
   - Adjust teams with `/addtoteam`
   - Save match with `/match SAVE`
   - Update match score
   - View matches list with `/matches`
   - View latest match details
   - Clear data with `/clearbench` and `/clearteam`

### Manual HTTP Testing

You can also send individual commands using curl:

```bash
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{"command": "/addme"}'
```

### Manual Testing in Telegram

For testing interactive features (buttons, callbacks), test directly in Telegram:

```bash
yarn dev:bot
```

Then interact with your bot through Telegram.

For detailed testing documentation, see [docs/TESTING.md](docs/TESTING.md).
