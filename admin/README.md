# ChiaTeam Admin Client

A modern admin dashboard for managing the ChiaTeam football bot data.

## Features

- 📊 **Dashboard** - Overview of all statistics and recent activity
- 👥 **Players Management** - View, create, edit, and delete player registrations
- ⚽ **Matches Management** - Manage match records with scores and details
- 🏆 **Leaderboard** - View and edit player statistics and rankings

## Tech Stack

- **Framework**: Next.js 15 with TypeScript
- **UI Components**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **API**: REST API integration with the ChiaTeam API server

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- ChiaTeam API server running (default: http://localhost:8080)

### Installation

1. Navigate to the admin directory:

```bash
cd admin
```

2. Install dependencies:

```bash
yarn install
```

3. Create a `.env.local` file:

```bash
cp .env.example .env.local
```

4. Update the environment variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### Development

Run the development server:

```bash
yarn dev
```

Open [http://localhost:8389](http://localhost:8389) in your browser.

### Production Build

Build the application:

```bash
yarn build
```

Start the production server:

```bash
yarn start
```

## Project Structure

```
admin/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── dashboard/         # Dashboard page
│   │   ├── players/           # Players management page
│   │   ├── matches/           # Matches management page
│   │   ├── leaderboard/       # Leaderboard page
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home page
│   │   └── globals.css        # Global styles
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   └── navigation.tsx     # Navigation component
│   ├── lib/
│   │   ├── api-client.ts      # API client utilities
│   │   └── utils.ts           # Utility functions
│   └── types/                 # TypeScript type definitions
│       ├── player.ts
│       ├── match.ts
│       └── leaderboard.ts
├── public/                    # Static files
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.ts
```

## API Integration

The admin client connects to the ChiaTeam API server. Make sure the API server is running before using the admin client.

Default API endpoints:

- `GET /players` - List all players
- `POST /players` - Create a new player
- `PUT /players/:number` - Update a player
- `DELETE /players/:number` - Delete a player
- `GET /matches` - List all matches
- `POST /matches` - Create a match
- `PUT /matches/:date` - Update a match
- `DELETE /matches/:date` - Delete a match
- `GET /leaderboard` - Get leaderboard data
- `PUT /leaderboard/:playerNumber` - Update leaderboard entry

## License

MIT
