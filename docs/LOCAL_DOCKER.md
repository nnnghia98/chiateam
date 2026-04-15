# Local Docker Development (Hybrid Workflow)

Use Docker locally for `api` + `bot` parity checks, while keeping native `yarn dev:*` for fastest coding loops.

## Required Setup

1. Create `.env.local` from `.env.local.example`.
2. Keep `DATABASE_URL` pointing to your external DB.

## Start Local Dev Stack

```bash
yarn docker:dev:up
```

Services:
- API: `http://localhost:8787`
- Bot: running with `yarn dev:bot` inside container

View logs:

```bash
yarn docker:dev:logs
```

Stop stack:

```bash
yarn docker:dev:down
```

## Production-Parity Check Locally

Run the production compose stack locally (no hot reload):

```bash
yarn docker:prod:up
yarn docker:prod:down
```

## Persistent Bot Runtime State

Dev and prod compose both mount:

- Host: `.runtime/bot`
- Container: `/app/.runtime/bot`

So `.runtime/bot/storage.json` persists between container restarts.

## Troubleshooting

- **Compose fails reading `.env.local`**
  - Ensure `.env.local` uses standard `KEY=value` lines.
  - Remove invalid inline syntax such as `//` comment lines.
- **Bot cannot reach API in Docker**
  - Keep `BOT_API_BASE_URL=http://api:8787` for container-to-container calls.
- **File changes do not hot reload**
  - Restart dev stack once, then check logs.
  - Docker setup already enables polling (`CHOKIDAR_USEPOLLING=true`) for reliable host file watching.
