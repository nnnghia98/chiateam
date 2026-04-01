## Sprint 12 – Admin Panel & API Management (chiateam-bot)

**Period**: 2026, Sprint 12  
**Area**: Full-featured admin panel with role-based authentication, API endpoints for player/match/leaderboard management, and Railway deployment configuration.

### Goals

- Build comprehensive web-based admin panel for system management
- Implement role-based authentication (admin vs viewer)
- Add API endpoints for CRUD operations on players, matches, and leaderboard
- Enable API authorization to protect write operations
- Configure responsive UI for mobile/tablet devices
- Set up Railway deployment for admin panel

### Key Changes

#### Admin Panel (`/admin`)

- **Next.js Application**:
  - Created full Next.js 15 app with React 19
  - Integrated shadcn/ui component library
  - Configured Tailwind CSS with custom theme
  - TypeScript for type safety across entire app

- **Authentication System**:
  - Simple password-based authentication via localStorage
  - Two user roles with different access levels:
    - **Admin** (🛡️): Full access - can view and edit everything
    - **Viewer** (👁️): Read-only access - can only view data
  - Auth context (`src/contexts/auth-context.tsx`) manages user state
  - Protected routes with automatic redirect to login
  - Login page (`src/app/login/page.tsx`) with password input

- **UI Components** (`src/components/ui/`):
  - Button, Card, Input, Label, Table - standard UI elements
  - Sheet - drawer component for mobile navigation
  - All components built with Radix UI primitives

- **Navigation** (`src/components/navigation.tsx`):
  - Desktop: Full horizontal navigation bar with all links
  - Mobile/Tablet: Hamburger menu with side drawer
  - Responsive breakpoint at `lg` (1024px)
  - Shows current user role badge
  - Logout button in navigation

- **Dashboard Page** (`src/app/dashboard/page.tsx`):
  - Overview cards: Total Players, Total Matches, Top Scorer, Best Win Rate
  - Recent Matches table (last 5)
  - Top Scorers leaderboard (top 5 with medals 🥇🥈🥉)
  - Real-time data from API

- **Players Page** (`src/app/players/page.tsx`):
  - List all registered players with stats
  - **Admin**: Can add, edit, and delete players
  - **Viewer**: Read-only view, edit buttons hidden
  - Create/Edit form with name, number, username fields
  - Confirmation before deletion

- **Leaderboard Page** (`src/app/leaderboard/page.tsx`):
  - Ranked list by win rate with stats
  - Shows: Goals, Assists, Matches, W/L/D record
  - **Admin**: Can edit player statistics directly
  - **Viewer**: Read-only table view
  - Edit form updates: goals, assists, matches, wins, losses, draws
  - Automatic winrate recalculation

- **Matches Page** (`src/app/matches/page.tsx`):
  - List all matches with details
  - Shows match date, location, teams, scores
  - Sorting and filtering capabilities
  - View match details with player lineups

- **Responsive Design**:
  - Mobile-first approach with Tailwind
  - Viewport config prevents zoom on input focus:
    - `maximumScale: 1`
    - `userScalable: false`
  - Drawer navigation for tablets and phones
  - Grid layouts adapt to screen size

#### API Enhancements

- **CORS Configuration** (`api/routes/server.js`):
  - Added `localhost:8389` for admin UI
  - Support for `ADMIN_UI_URL` environment variable
  - Updated to allow `PUT` method and `X-User-Role` header

- **Authorization System**:
  - Role-based access control via `X-User-Role` header
  - `isAdmin()` helper checks user role
  - `requireAdmin()` middleware returns 403 for unauthorized access
  - Applied to all write operations (POST, PUT, DELETE)

- **New Endpoints**:
  - `GET /api/player-summaries` - Players with combined stats
  - `PUT /api/leaderboard/:playerNumber` - Update player statistics
  - Enhanced player endpoints with admin checks

- **Leaderboard Management** (`api/routes/leaderboard.js`):
  - New `updatePlayerStats()` function for direct stat updates
  - Automatic winrate calculation on updates
  - Handles both creating new entries and updating existing
  - Supports partial updates (only changed fields)

- **API Client** (`admin/src/lib/api-client.ts`):
  - TypeScript class for all API calls
  - Automatic auth headers with user role
  - Error handling with formatted messages
  - Methods for all CRUD operations

#### Type Definitions (`admin/src/types/`)

- **Player Type** (`player.ts`):
  - id, name, number, username, user_id, created_at

- **LeaderboardEntry Type** (`leaderboard.ts`):
  - Nested structure: `player` object + `stats` object
  - Stats: total_match, total_win, total_lose, total_draw, goal, assist, winrate

- **Match Type** (`match.ts`):
  - Match details with teams and scores

#### Deployment Configuration

- **Railway Setup**:
  - Created `admin/railway.json` with build/deploy config
  - Created `admin/nixpacks.toml` for Nixpacks builder
  - Configured for monorepo structure
  - Start command: `yarn start` (Next.js production)

- **Environment Variables** (`.env.example`):

  ```env
  NEXT_PUBLIC_API_URL=http://localhost:8787
  NEXT_PUBLIC_ADMIN_PASSWORD=admin123
  NEXT_PUBLIC_VIEWER_PASSWORD=viewer123
  ```

- **Package Scripts** (`package.json`):
  - `dev:admin` - Run admin in development mode
  - `build:admin` - Build admin for production
  - `start:admin` - Start admin in production

#### Documentation

- **README Updates**:
  - Added admin panel setup section
  - Authentication system explanation
  - Development and deployment instructions
  - Two-role access control documentation

- **Admin DEPLOYMENT.md**:
  - Vercel deployment guide
  - Netlify deployment guide
  - Docker deployment guide
  - Railway-specific instructions

- **Admin QUICKSTART.md**:
  - Quick installation steps
  - Local development setup
  - Environment configuration

### Technical Architecture

#### Admin Stack

```
Frontend: Next.js 15 + React 19
Styling: Tailwind CSS + shadcn/ui
State: React Context API (Auth)
API: Fetch with custom client
Types: TypeScript
UI: Radix UI + Lucide Icons
```

#### API Stack

```
Server: Node.js HTTP Server
Database: PostgreSQL (via existing connection)
Auth: Header-based (X-User-Role)
CORS: Configurable origins
Endpoints: RESTful JSON API
```

#### File Structure

```
admin/
├── src/
│   ├── app/                    # Next.js pages
│   │   ├── dashboard/
│   │   ├── players/
│   │   ├── leaderboard/
│   │   ├── matches/
│   │   └── login/
│   ├── components/
│   │   ├── ui/                 # shadcn components
│   │   ├── navigation.tsx
│   │   └── client-layout.tsx
│   ├── contexts/
│   │   └── auth-context.tsx   # Authentication
│   ├── lib/
│   │   ├── api-client.ts      # API wrapper
│   │   └── utils.ts
│   └── types/                  # TypeScript types
├── railway.json               # Railway config
├── nixpacks.toml             # Nixpacks config
└── package.json
```

### Security Considerations

- **Client-Side Auth**: Simple password stored in localStorage
  - Suitable for internal tools
  - Not for sensitive production data
  - Recommend upgrading to JWT/session tokens for production

- **API Protection**:
  - All write operations require admin role
  - Returns 403 Forbidden for unauthorized access
  - CORS restricted to known origins

- **Future Improvements**:
  - Password hashing
  - Session expiration
  - Rate limiting on login
  - HTTPS enforcement
  - Multi-user support with database

### Git Commits

```
feat(admin): add admin panel with authentication and role-based access
feat(api): add admin authorization and leaderboard management endpoints
docs: update documentation and configuration for admin panel
chore(admin): add Railway deployment configuration
```

### Testing Checklist

- [x] Admin login with admin password
- [x] Viewer login with viewer password
- [x] Admin can create/edit/delete players
- [x] Viewer cannot see edit buttons
- [x] API blocks viewer write operations (403)
- [x] Dashboard shows correct stats
- [x] Leaderboard updates correctly
- [x] Mobile navigation drawer works
- [x] Logout redirects to login
- [x] Protected routes redirect when not authenticated

### Deployment Steps

1. **Deploy Bot API** (existing):
   - Railway service running on `https://your-bot.railway.app`
   - Handles player data, matches, leaderboard

2. **Deploy Admin Panel** (new):
   - Add new Railway service from same repo
   - Set root directory to `admin`
   - Configure environment variables
   - Generate public domain
   - Update API CORS with admin domain

### Future Enhancements

- [ ] Match creation/editing in admin panel
- [ ] Player search and filtering
- [ ] Export data to CSV/Excel
- [ ] Activity logs / audit trail
- [ ] Multiple admin users in database
- [ ] Password reset functionality
- [ ] Session timeout
- [ ] Dark mode theme
- [ ] Bulk operations (delete multiple players)
- [ ] Match statistics visualization

### Related Files

**Admin Panel**:

- `admin/src/app/dashboard/page.tsx`
- `admin/src/app/players/page.tsx`
- `admin/src/app/leaderboard/page.tsx`
- `admin/src/app/matches/page.tsx`
- `admin/src/app/login/page.tsx`
- `admin/src/contexts/auth-context.tsx`
- `admin/src/components/navigation.tsx`
- `admin/src/lib/api-client.ts`

**API**:

- `api/routes/server.js`
- `api/routes/leaderboard.js`

**Configuration**:

- `admin/railway.json`
- `admin/nixpacks.toml`
- `admin/.env.example`
- `.env.example`

### Success Metrics

- ✅ Admin panel fully functional
- ✅ Role-based access working
- ✅ All CRUD operations tested
- ✅ Mobile responsive
- ✅ API secured with authorization
- ✅ Ready for Railway deployment
- ✅ Documentation complete

---

**Status**: ✅ COMPLETE & READY FOR DEPLOYMENT
