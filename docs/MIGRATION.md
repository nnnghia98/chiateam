# ChiaTeam Bot — Migration Plan

## Dead Server → New Cloud Services

---

## Current Stack (Dead Server)

| Layer         | Technology                                  |
| ------------- | ------------------------------------------- |
| Bot runtime   | Node.js + PM2, `node-telegram-bot-api`      |
| Database      | SQLite (`chamhet.db`) on-disk               |
| Web UI        | Next.js in Docker (port 3000)               |
| API server    | Node.js HTTP (port 8787)                    |
| Reverse proxy | Nginx (port 80)                             |
| Server        | Ubuntu @ `15.152.155.89` (**gone forever**) |

> **Warning:** Railway is NOT suitable — its shared egress IPs are blocked by Telegram. Confirmed from previous deployment.

> **Caution:** The SQLite DB lived on the dead server. Check if `src/chamhet.db` locally has data — that's the only chance to recover it.

---

## New Stack

| Layer         | Service                       | Notes                                                        |
| ------------- | ----------------------------- | ------------------------------------------------------------ |
| **Bot + API** | **Render.com**                | Free 750 hrs/mo, persistent service, no credit card required |
| **Database**  | **Supabase** (PostgreSQL)     | Dashboard, Table Editor, 500 MB free                         |
| **Web UI**    | **Vercel**                    | Zero-config Next.js, free                                    |
| **AI**        | **Google AI Studio (Gemini)** | Match summaries, NL queries                                  |

> **Why not Railway?** Railway's shared egress IPs are blocked by Telegram (confirmed from previous attempt).

---

## Code Changes Made

### 1. Database (`sqlite3` → `pg`)

**`src/db/config.js`** — replaced `sqlite3` with `pg Pool`:

```js
const { Pool } = require('pg');
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});
```

**Files refactored** (callbacks → async/await, `?` → `$1/$2`):

- `src/api/players.js`
- `src/api/matches.js`
- `src/api/leaderboard.js`
- `src/services/player-service.js` (error codes: `SQLITE_CONSTRAINT` → `23505`)

**`package.json`:**

```diff
- "sqlite3": "^5.1.7"
+ "pg": "^8.13.0"
+ "@google/generative-ai": "^0.21.0"
```

### 2. Supabase Schema (PostgreSQL)

Run in **Supabase Dashboard → SQL Editor**:

```sql
CREATE TABLE leaderboard (
  id SERIAL PRIMARY KEY, player_number INTEGER NOT NULL UNIQUE,
  total_match INTEGER DEFAULT 0, total_win INTEGER DEFAULT 0,
  total_lose INTEGER DEFAULT 0, total_draw INTEGER DEFAULT 0,
  winrate FLOAT DEFAULT 0.0, goal INTEGER DEFAULT 0, assist INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE players (
  id SERIAL PRIMARY KEY, user_id BIGINT NOT NULL UNIQUE,
  number INTEGER NOT NULL, name TEXT NOT NULL, username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE matches (
  id SERIAL PRIMARY KEY, match_date DATE NOT NULL UNIQUE,
  san TEXT, tiensan INTEGER, home_score INTEGER, away_score INTEGER, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE match_players (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id),
  side TEXT NOT NULL, display_name TEXT
);

CREATE TABLE match_player_stats (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id),
  goals INTEGER DEFAULT 0, assists INTEGER DEFAULT 0, is_mvp INTEGER DEFAULT 0,
  UNIQUE(match_id, player_id)
);
```

**Key type changes from SQLite:**
| SQLite | PostgreSQL |
|---|---|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| `INTEGER` (user_id) | `BIGINT` (Telegram IDs > 32-bit) |
| `REAL` | `FLOAT` |
| `DATETIME DEFAULT CURRENT_TIMESTAMP` | `TIMESTAMPTZ DEFAULT NOW()` |
| `?` placeholders | `$1, $2, $3...` |
| `INSERT OR REPLACE` | `INSERT ... ON CONFLICT DO UPDATE` |

### 3. AI Service (New)

**`src/services/ai-service.js`** — two Gemini capabilities:

- `generateMatchSummary(matchData)` — fun Vietnamese match commentary
- `parseMatchResultText(text)` — structured output: parses _"thua 3-5, Nam 2 bàn"_ → JSON

### 4. Infrastructure

**`Dockerfile`** — used for containerized deployment. Exposes port 8787, runs `yarn start:production`.

**`src/api/server.js`** — CORS updated:

```diff
- 'http://15.152.155.89'
+ process.env.WEB_UI_URL  // dynamic, set via env var
```

**`src/db/init-database.js`** — simplified to only test Supabase connection (schema managed via dashboard).

---

## Environment Variables

| Variable                      | Where      | Purpose                     |
| ----------------------------- | ---------- | --------------------------- |
| `TELEGRAM_BOT_TOKEN`          | Render.com | Telegram bot token          |
| `BOT_OWNER_ID`                | Render.com | Owner Telegram ID           |
| `BOT_ADMIN_IDS`               | Render.com | Admin IDs (comma-separated) |
| `CHAT_ID`                     | Render.com | Main group chat ID          |
| `MAIN_THREAD_ID`              | Render.com | Thread IDs                  |
| `ANNOUNCEMENT_THREAD_ID`      | Render.com | Thread IDs                  |
| `VIP_THREAD_ID`               | Render.com | Thread IDs                  |
| `STATISTICS_THREAD_ID`        | Render.com | Thread IDs                  |
| `DATABASE_URL`                | Render.com | Supabase connection string  |
| `GEMINI_API_KEY`              | Render.com | Google AI Studio key        |
| `WEB_UI_URL`                  | Render.com | Vercel URL (for CORS)       |
| `NEXT_PUBLIC_UI_API_BASE_URL` | Vercel     | Render.com service URL      |

> `DATABASE_NAME`, `DB_PATH`, `DB_DIR` are **no longer needed**.

---

## Operational Access (vs Old SSH)

| Task        | Old (SSH)              | New                                   |
| ----------- | ---------------------- | ------------------------------------- |
| View logs   | `ssh → pm2 logs`       | Render.com Dashboard → Logs tab       |
| Env vars    | `.env` on server       | Render.com Dashboard → Environment    |
| DB browse   | sqlite3 CLI            | Supabase Table Editor                 |
| DB export   | `sqlite3 .dump`        | Supabase → Settings → Download backup |
| DB import   | Manual                 | Supabase SQL Editor                   |
| Public IP   | Static `15.152.155.89` | Render.com auto-assigned HTTPS URL    |
| Web UI logs | `docker logs`          | Vercel dashboard                      |

---

## Deployment Steps

### 1. Recover Old Data (optional)

```bash
sqlite3 src/chamhet.db .dump > backup.sql
# Convert backup.sql to PostgreSQL syntax before importing
```

### 2. Set Up Services

1. **Supabase** → create project → run schema above → copy `DATABASE_URL`
2. **Google AI Studio** → get API key at [aistudio.google.com](https://aistudio.google.com)
3. **Render.com** → see `docs/DEPLOY_RENDER.md` for full guide
4. **Vercel** → import repo → root dir: `web/`

### 3. Test Locally

```bash
cp .env.example .env   # fill in real values
yarn install
node src/db/init-database.js   # verify Supabase connection
yarn dev                        # run bot locally
```

### 4. Deploy Bot (Render.com)

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo
3. Set: **Build Command** `yarn install`, **Start Command** `yarn start:production`
4. Add all env vars from `.env` in the **Environment** tab
5. Deploy

### 5. Deploy Web UI (Vercel)

- Set env var: `NEXT_PUBLIC_UI_API_BASE_URL=https://chiateam-bot.onrender.com`

---

## Verification

- `node src/db/init-database.js` → `✅ Supabase connection successful`
- `curl https://your-service-url.run.app/api/status` → `{"online":true}`
- Telegram: `/start`, `/players`, `/leaderboard` → bot responds
- Vercel URL → players and matches load
- Add player via Web UI → appears in Supabase Table Editor
