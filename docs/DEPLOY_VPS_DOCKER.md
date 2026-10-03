# Docker Deploy to VPS (Bot + API)

This project deploys with Docker Compose on VPS using GitHub Actions + GHCR.

## What runs on VPS

- `api` container on port `8787`
- `bot` container (no public port)

Both `bot` and `api` share the same app image (`Dockerfile`) with different start commands.

## Persistent Bot State

Next-match state is stored only in PostgreSQL table `storage`. `DATABASE_URL`
is required. No JSON file or bot-state volume is used. The deployment workflow
does not copy legacy storage files. Back up PostgreSQL through your database
provider before risky rollouts.

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
- `.env` present at `APP_DIR/.env` with the VPS values
- Network/firewall allows port `8787` (API) as needed

## Deploy Flow

On push to `main` (or manual `workflow_dispatch`), workflow:

1. Builds/pushes:
   - `ghcr.io/<owner>/<repo>/app:sha-<commit>`
2. Uploads `docker-compose.yml` to VPS.
4. Stops/removes old PM2 process `chiateam` if present.
5. Updates `APP_IMAGE` in the VPS `.env` for the rollout and runs:
   - `docker compose --env-file .env up -d --remove-orphans --no-build`
6. Verifies health:
   - `http://127.0.0.1:8787/healthz`

## One-time Cutover Checklist

1. Ensure `.env` is created in `APP_DIR` with the VPS values.
2. Ensure GHCR pull credentials are valid.
3. Back up PostgreSQL table `storage` through your database provider before a risky rollout.
4. Run workflow manually once (`workflow_dispatch`) to cut over.
5. Verify:
   - Telegram bot responds.
   - PostgreSQL table `storage` has one row with `id = 1`.
   - Bot state can be read from PostgreSQL after container restart.
