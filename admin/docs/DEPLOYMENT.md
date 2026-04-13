# Chiateam Admin - Deployment Guide

Deploy the admin app as a separate Next.js service with server-side env vars.

## Required environment variables

```env
API_INTERNAL_URL=url
INTERNAL_API_AUTH_TOKEN=change-this-shared-internal-token
ADMIN_SESSION_SECRET=change-this-session-secret
ADMIN_PASSWORD=strong-admin-password
VIEWER_PASSWORD=strong-viewer-password
```

## Vercel

1. Import the repository
2. Set the root directory to `admin`
3. Add the required env vars
4. Deploy

`API_INTERNAL_URL` can point to a private hostname or a server-side reachable public API URL.

## Railway / private-network hosting

If admin and API live in the same private network:

- point `API_INTERNAL_URL` at the private API hostname
- use the same `INTERNAL_API_AUTH_TOKEN` value on both services

## Security notes

- `ADMIN_PASSWORD` and `VIEWER_PASSWORD` must remain server-only
- `ADMIN_SESSION_SECRET` must be unique per environment
- do not expose `INTERNAL_API_AUTH_TOKEN` to the browser
