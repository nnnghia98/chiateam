# Chiateam Admin - Quick Start

## Prerequisites

- Root API running on `http://localhost:8787`
- `admin/.env.local` created from `admin/.env.example`

## Start

```bash
cd admin
yarn install
yarn dev
```

Open `http://localhost:8389`.

## Required env

```env
API_INTERNAL_URL=http://localhost:8787
INTERNAL_API_AUTH_TOKEN=change-this-shared-internal-token
ADMIN_SESSION_SECRET=change-this-session-secret
ADMIN_PASSWORD=admin123
VIEWER_PASSWORD=viewer123
```

## Roles

- `viewer`: read-only access
- `admin`: create, update, and delete access

## Common issues

- `401/403 from /api/proxy`: session missing or role is not allowed
- `502 from /api/proxy`: admin server cannot reach `API_INTERNAL_URL`
- login succeeds but writes fail: `INTERNAL_API_AUTH_TOKEN` does not match the API service
