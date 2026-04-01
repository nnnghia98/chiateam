# ChiaTeam Admin - Quick Start Guide

Get the admin client up and running in 5 minutes!

## Prerequisites

✅ Node.js 18 or higher installed  
✅ ChiaTeam API server running on port 8080

## Installation

### Step 1: Navigate to admin directory

```bash
cd admin
```

### Step 2: Install dependencies

```bash
yarn install
```

This will install all required packages including:

- Next.js
- React
- shadcn/ui components
- Tailwind CSS
- TypeScript

### Step 3: Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### Step 4: Start development server

```bash
yarn dev
```

That's it! Open http://localhost:8389 in your browser.

## First Time Usage

### 1. Dashboard

Visit the dashboard at http://localhost:8389/dashboard to see:

- Total players count
- Total matches count
- Top scorers
- Recent matches

### 2. Players Management

Go to http://localhost:8389/players to:

- View all registered players
- Add new players (name + shirt number)
- Edit player information
- Delete players

### 3. Matches Management

Go to http://localhost:8389/matches to:

- View all matches
- Create new match records
- Edit match details (scores, location, notes)
- Delete matches

### 4. Leaderboard

Go to http://localhost:8389/leaderboard to:

- View player rankings by win rate
- Edit player statistics (goals, assists, wins/losses)
- View detailed player performance

## Common Tasks

### Adding a New Player

1. Click "Players" in navigation
2. Click "Add Player" button
3. Fill in name and shirt number
4. Click "Create"

### Recording a Match

1. Click "Matches" in navigation
2. Click "Add Match" button
3. Enter match date
4. Fill in optional details (location, scores, notes)
5. Click "Create"

### Updating Stats

1. Click "Leaderboard" in navigation
2. Find the player you want to edit
3. Click the edit button (pencil icon)
4. Update goals, assists, or match records
5. Click "Update"

## Keyboard Shortcuts

- `Home` → Dashboard
- `Alt+P` → Players
- `Alt+M` → Matches
- `Alt+L` → Leaderboard

## Troubleshooting

### "Failed to load players/matches/leaderboard"

**Problem**: Can't connect to API server  
**Solution**:

1. Verify API server is running on port 8080
2. Check `NEXT_PUBLIC_API_URL` in `.env.local`
3. Check browser console for CORS errors

### "Port 8389 already in use"

**Problem**: Another process is using port 8389  
**Solution**:

```bash
# Option 1: Kill the process
lsof -ti:8389 | xargs kill -9

# Option 2: Use a different port
yarn dev -- -p 8390
```

### Build errors

**Problem**: TypeScript or build errors  
**Solution**:

```bash
# Clear cache and reinstall
rm -rf .next node_modules yarn.lock
yarn install
yarn dev
```

## Development Tips

### Hot Reload

The dev server supports hot reload - just save your files and changes appear instantly.

### API Changes

If you modify the API endpoints, update `src/lib/api-client.ts`.

### Adding New Pages

1. Create a new folder in `src/app/`
2. Add a `page.tsx` file
3. The route will be automatically available

### Styling

- Use Tailwind CSS classes for styling
- shadcn/ui components are in `src/components/ui/`
- Global styles are in `src/app/globals.css`

## Production Build

When ready for production:

```bash
# Build the application
yarn build

# Start production server
yarn start
```

## Next Steps

- [ ] Set up authentication (optional)
- [ ] Configure production environment variables
- [ ] Deploy to Vercel/Netlify (see DEPLOYMENT.md)
- [ ] Set up monitoring and analytics
- [ ] Customize theme colors in tailwind.config.js

## Need Help?

- Check the [README.md](README.md) for detailed documentation
- See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- Review the API documentation in `../api/`

---

**Happy managing! ⚽🏆**
