# Chiateam Admin

Next.js admin UI for viewing and managing players, matches, and leaderboard data.

## How it talks to the API

The browser never calls the API service directly.

- browser -> `/api/proxy/...`
- Next.js proxy -> server-side API origin from `API_INTERNAL_URL`
- proxy auth -> HTTP-only session cookie + `INTERNAL_API_AUTH_TOKEN`

Viewer sessions can read. Admin sessions can mutate.

## Local setup

```bash
cd admin
cp .env.example .env.local
yarn install
yarn dev
```

Required server-side env values:

```env
API_INTERNAL_URL=http://localhost:8787
INTERNAL_API_AUTH_TOKEN=change-this-shared-internal-token
ADMIN_SESSION_SECRET=change-this-session-secret
ADMIN_PASSWORD=admin123
VIEWER_PASSWORD=viewer123
```

Open [http://localhost:8389](http://localhost:8389).

## App structure

- `src/app/` routes and proxy/auth handlers
- `src/components/` layout, navigation, UI primitives
- `src/contexts/` session-aware auth state
- `src/lib/` proxy client and server auth helpers
- `src/types/` admin UI types
