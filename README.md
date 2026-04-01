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

## Project Structure

This project consists of four main components:

### 1. Bot (`/bot`)

Telegram bot for team management, player registration, and match organization.

**Start bot**:

```bash
yarn dev:bot      # Development
yarn start:bot    # Production
```

### 2. API (`/api`)

REST API server providing data access for the web and admin interfaces.

**Start API**:

```bash
yarn dev:api      # Development
yarn start:api    # Production
```

### 3. Web (`/web`)

Public-facing Next.js web application for viewing matches and leaderboards.

**Start web**:

```bash
yarn dev:web      # Development (runs on port 3000)
```

### 4. Admin (`/admin`)

**NEW!** Admin dashboard for managing players, matches, and leaderboard data.

**Features**:

- 📊 Dashboard with overview statistics
- 👥 Players management (CRUD operations)
- ⚽ Matches management
- 🏆 Leaderboard editing

**Start admin**:

```bash
yarn dev:admin    # Development (runs on port 8389)
yarn build:admin  # Build for production
yarn start:admin  # Production
```

**Setup**:

1. Navigate to admin folder: `cd admin`
2. Install dependencies: `yarn install`
3. Create `.env.local` file: `cp .env.example .env.local`
4. Update `NEXT_PUBLIC_API_URL` to point to your API server
5. Run development server: `yarn dev`

See [admin/README.md](admin/README.md) for detailed documentation.
