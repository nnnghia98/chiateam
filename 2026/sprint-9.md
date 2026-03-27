## Sprint 9 – Cloud Migration & AI Integration (chiateam-bot)

**Period**: 2026, Sprint 9  
**Area**: Replace defunct local server with fully managed cloud infrastructure and introduce AI features.

### Goals

- Migrate from local SQLite to a managed PostgreSQL database (Supabase) to support stateless cloud deployments.
- Move bot and API hosting from a decommissioned Ubuntu server to a free, persistent cloud provider (Render.com) that doesn't suffer from Telegram IP blocking.
- Deploy the Next.js Web UI to a zero-config edge network (Vercel).
- Integrate Google AI Studio (Gemini) to generate natural language match summaries and parse unstructured result inputs.

### Key Changes

- **Database Migration (`sqlite3` → `pg`)**:
  - Swapped `sqlite3` driver for `pg` (node-postgres) pointing to Supabase via `DATABASE_URL`.
  - Refactored all data access layers (`src/api/players.js`, `matches.js`, `leaderboard.js`) from SQLite callbacks to PostgreSQL `async/await` Promises.
  - Converted table schemas: `INTEGER PRIMARY KEY AUTOINCREMENT` to `SERIAL PRIMARY KEY`, `DATETIME` to `TIMESTAMPTZ`, and Telegram user IDs from 32-bit `INTEGER` to 64-bit `BIGINT`.
  - Replaced SQLite-specific syntax (e.g., `INSERT OR REPLACE` replaced with `INSERT ... ON CONFLICT DO UPDATE`, `?` placeholders updated to `$1, $2`).
  - Adapted error handling in `player-service.js` to catch PostgreSQL's unique violation code `23505` instead of `SQLITE_CONSTRAINT`.

- **Infrastructure & Hosting**:
  - **Bot & API (Render.com)**: Replaced the old PM2/Nginx/Ubuntu setup with a Dockerized web service on Render. Added `web/` and `docs/` to `.dockerignore` for leaner container builds. Exposed port 8787 for internal API communication.
  - **Web UI (Vercel)**: Separated frontend hosting to Vercel. Configured `NEXT_PUBLIC_UI_API_BASE_URL` to point to the Render API endpoint.
  - **CORS**: Updated `src/api/server.js` to dynamically allow requests from `process.env.WEB_UI_URL`.

- **AI Integration (`src/services/ai-service.js`)**:
  - Integrated `@google/generative-ai` SDK (`gemini-2.0-flash` model).
  - Added `generateMatchSummary(matchData)`: Generates humorous, context-aware Vietnamese football commentary based on match results and player goals.
  - Added `parseMatchResultText(text)`: Extracts structured JSON (home/away queries) from natural language (e.g., "thua 3-5").

- **Documentation**:
  - `docs/MIGRATION.md` – Comprehensive guide mapping the old stack to the new Cloud infrastructure, detailing schema conversions and operational tools.
  - `docs/DEPLOY_RENDER.md` – Step-by-step deployment guide for establishing a persistent, free-tier Render container.

### Impact

- **True Cloud Native**: The bot is no longer tied to an on-premise SQLite file, enabling scaling, instant remote deployments, and stateless container restarts without data loss.
- **Zero Cost, High Uptime**: Moved off Railway/Fly.io to Render.com + Supabase + Vercel + Gemini, creating a robust, 100% free stack that natively bypasses Telegram polling restrictions.
- **Smart Features**: Laying the foundation for NL-based updates and automated match reports via AI.
- **Security & Portability**: Extracted all hardcoded server IPs into environment variables (`WEB_UI_URL`), resolving CORS dynamically.

### Files Modified

**Backend**:
- `src/db/config.js` – Replaced sqlite3 Pool with pg Pool.
- `src/db/init-database.js` – Swapped local setup for Supabase connection verification.
- `src/api/players.js`, `matches.js`, `leaderboard.js` – Full async/await refactor and SQL dialect updates.
- `src/services/player-service.js` – PG error handling.
- `src/api/server.js` – Dynamic CORS handling.
- `src/services/ai-service.js` – New AI capabilities.
- `package.json` – Swapped `sqlite3` for `pg` and `@google/generative-ai`.

**Infrastructure**:
- `Dockerfile` & `.dockerignore` – Cloud deployment readiness.
- `docs/MIGRATION.md` & `docs/DEPLOY_RENDER.md` – Modern operational playbooks.
