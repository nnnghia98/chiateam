# ChiaTeam Bot

Bot and HTTP API for organising weekly amateur football sessions: signups,
bench and team shuffling, venue and fee tracking, attendance votes, player
registration, and match history.

- Platforms: Telegram (primary), Zalo, and Messenger.
- Storage: PostgreSQL (for example Supabase). There is no file-based state.
- One installation manages one football community.
- Bot replies are in Vietnamese and fees are in VND.

The admin panel web app is a separate project and is not part of this
repository. The API in this repository serves it.

## Quick start

You need Node.js 22, Yarn 1, and a PostgreSQL database.

```bash
yarn setup        # creates .env from .env.example and installs dependencies
```

Add your own values to `.env`, then create the tables and start everything:

```bash
# fresh database: run api/db/postgres-schema.sql once, then
yarn init-db      # verify the connection and runtime tables
yarn dev:all      # API + Telegram bot
```

`yarn dev:all` does not start Zalo or Messenger delivery. Both use separate
webhook deployments. See [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md) for
database details and [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for every
setting.

## Common commands

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `yarn dev:all`      | Start the API and the Telegram bot    |
| `yarn dev:api`      | Start only the API (default `:8787`)  |
| `yarn dev:bot`      | Start only the Telegram bot           |
| `yarn start:api`    | Run the API in production mode        |
| `yarn start:bot`    | Run the bot in production mode        |
| `yarn init-db`      | Check the database and runtime tables |
| `yarn test`         | Run the test suite                    |
| `yarn lint`         | Run ESLint                            |
| `yarn format:check` | Check Prettier formatting             |
| `yarn format`       | Apply Prettier formatting             |

Check that the API is up with `curl http://localhost:8787/healthz`.

## Project layout

```text
bot/                 Telegram bot runtime and command handlers
core/                Platform-independent command contracts and football rules
platforms/           Thin platform input/output adapters
runtime/             Shared command wiring and repository adapters
api/                 HTTP API, data-access routes, and domain services
api/db/              Database connection and verification scripts
config/              Shared environment and maintenance-mode config
docs/                Setup, deployment, and integration notes
Dockerfile           Image that Railway builds for the bot and API
```

Entrypoints: `bot/index.js` (Telegram bot), `api/index.js` (HTTP API),
`api/messenger-webhook.mjs` and `api/zalo-webhook.mjs` (webhook handlers), and
`config/load-env.js` (loads the root `.env`).

## Configuration

All settings live in one root `.env` file, described in
[.env.example](.env.example). In production, `INTERNAL_API_AUTH_TOKEN` must be
a private random value; the API refuses to start with it missing or set to a
public example value. Never commit `.env`, tokens, database credentials, or
database files.

## Deployment

The maintainer runs the bot and API on Railway, which redeploys automatically
on every push to `main`. Railway builds both services from the root
`Dockerfile`; the API service overrides the start command with
`node api/index.js`. See [docs/RAILWAY_SETUP.md](docs/RAILWAY_SETUP.md). Any
host that can run `node bot/index.js` and `node api/index.js` with the same
environment works. Back up PostgreSQL before risky rollouts.

## Documentation

| Topic                                                 | File                                                                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Bot commands, Telegram menu, and platform differences | [docs/BOT_COMMANDS.md](docs/BOT_COMMANDS.md)                                                                                             |
| Telegram mentions and Jev text actions                | [docs/TELEGRAM_JEV.md](docs/TELEGRAM_JEV.md)                                                                                             |
| API endpoints and data storage                        | [docs/API.md](docs/API.md)                                                                                                               |
| Environment, maintenance mode, and database checks    | [docs/CONFIGURATION.md](docs/CONFIGURATION.md)                                                                                           |
| Fresh database setup and migration safety             | [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md)                                                                                         |
| Railway deployment                                    | [docs/RAILWAY_SETUP.md](docs/RAILWAY_SETUP.md)                                                                                           |
| Adding or changing a platform adapter                 | [docs/ADAPTER_DEVELOPMENT.md](docs/ADAPTER_DEVELOPMENT.md)                                                                               |
| Messenger webhook setup                               | [docs/MESSENGER_ADAPTER.md](docs/MESSENGER_ADAPTER.md)                                                                                   |
| Zalo setup and broadcasts                             | [docs/ZALO_ADAPTER.md](docs/ZALO_ADAPTER.md), [docs/ZALO_BROADCAST.md](docs/ZALO_BROADCAST.md)                                           |
| Reply templates and private chat setup                | [docs/CHAT_REPLIES.md](docs/CHAT_REPLIES.md)                                                                                             |
| Common problems                                       | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)                                                                                       |
| Sample API calls                                      | [docs/HTTP_TEST_EXAMPLES.md](docs/HTTP_TEST_EXAMPLES.md)                                                                                 |
| Match commentary with Gemini (optional)               | [docs/AI_INTEGRATION.md](docs/AI_INTEGRATION.md)                                                                                         |
| World Cup predictions API                             | [docs/WORLD_CUP_PREDICTIONS_API.md](docs/WORLD_CUP_PREDICTIONS_API.md)                                                                   |
| Admin panel bot settings                              | [docs/BOT_MANAGEMENT_GUIDE.md](docs/BOT_MANAGEMENT_GUIDE.md), [docs/BOT_MANAGEMENT_SETTINGS_MAP.md](docs/BOT_MANAGEMENT_SETTINGS_MAP.md) |
| Command inventory (historical) and storage notes      | [docs/COMMAND_CATALOG.md](docs/COMMAND_CATALOG.md), [docs/JSON_STORAGE.md](docs/JSON_STORAGE.md)                                         |
| Release checklist and versioning                      | [docs/RELEASE.md](docs/RELEASE.md)                                                                                                       |

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Pull
requests run lint, the format check, and the tests. Report security problems
privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
