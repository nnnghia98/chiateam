# Docker Deploy to VPS (Bot + API)

This project deploys with Docker Compose on VPS using GitHub Actions + GHCR.

## What runs on VPS

- `api` container on port `8787`
- `bot` container (no public port)

Both `bot` and `api` share the same app image (`Dockerfile`) with different start commands.

## Persistent Bot State

Next-match state is persisted at:

- Host path: `.runtime/bot/storage.json` (inside `APP_DIR` on VPS)
- Container path: `/app/.runtime/bot/storage.json` (mounted from host)

Deployment automatically backs up this file before rollout to:

- `backups/bot-storage/storage-YYYYMMDD-HHMMSS.json`

## Required GitHub Secrets

Set these in repo settings:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
- `APP_DIR` (absolute deploy directory on VPS)
- `GHCR_USERNAME` (account that can pull from GHCR)
- `GHCR_TOKEN` (PAT with package read access)

## Required VPS Prerequisites

- Docker Engine + Docker Compose plugin installed
- `.env.production` present at `APP_DIR/.env.production`
- Network/firewall allows port `8787` (API) as needed

## Deploy Flow

On push to `main` (or manual `workflow_dispatch`), workflow:

1. Builds/pushes:
   - `ghcr.io/<owner>/<repo>/app:sha-<commit>`
2. Uploads `docker-compose.yml` to VPS.
3. Backs up `.runtime/bot/storage.json` on VPS.
4. Stops/removes old PM2 process `chiateam` if present.
5. Pulls image tags for current commit and runs:
   - `docker compose --env-file .env.deploy up -d --remove-orphans --no-build`
6. Verifies health:
   - `http://127.0.0.1:8787/healthz`

## One-time Cutover Checklist

1. Ensure `.env.production` is created in `APP_DIR` with production values.
2. Ensure GHCR pull credentials are valid.
3. Run workflow manually once (`workflow_dispatch`) to cut over.
4. Verify:
   - Telegram bot responds.
   - `.runtime/bot/storage.json` is preserved after container restart.
