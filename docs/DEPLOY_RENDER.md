# Deploy to Render.com

Render.com offers a **free Web Service tier** — no credit card required, no surprise charges.

> **Why Render?** Free tier, persistent process (no sleep for web services with keep-alive), and Telegram IPs are not blocked.

## Setup (One-Time)

1. Go to [render.com](https://render.com) and sign up (use GitHub login)
2. Click **New → Web Service**
3. Connect your GitHub repo (`chiateam-bot`)
4. Configure:
   - **Name:** `chiateam-bot`
   - **Region:** Singapore (Southeast Asia)
   - **Branch:** `main` (or your deploy branch)
   - **Runtime:** Node
   - **Build Command:** `yarn install`
   - **Start Command:** `yarn start:bot`
   - **Plan:** Free

## Set Environment Variables

In Render dashboard → your service → **Environment** tab, add all vars:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `TELEGRAM_BOT_TOKEN` | your token |
| `BOT_OWNER_ID` | your Telegram ID |
| `BOT_ADMIN_IDS` | comma-separated IDs |
| `CHAT_ID` | group chat ID |
| `MAIN_THREAD_ID` | `2` |
| `ANNOUNCEMENT_THREAD_ID` | `3` |
| `VIP_THREAD_ID` | `51` |
| `STATISTICS_THREAD_ID` | `52` |
| `DATABASE_URL` | Supabase connection string (URL-encode `@`→`%40`, `!`→`%21` in password) |
| `GEMINI_API_KEY` | AI Studio key (optional) |
| `ADMIN_UI_URL` | Admin app URL (for CORS) |
| `INTERNAL_API_AUTH_TOKEN` | Shared token for trusted admin proxy calls |
| `BOT_STATE_FILE` | Optional runtime state path (default: `.runtime/bot/storage.json`) |

## Deploy

Click **Deploy** — Render will build and start the service automatically.

Your service URL will be: `https://chiateam-bot.onrender.com`

## View Logs

Render dashboard → your service → **Logs** tab (live streaming).

## Update After Code Changes

Push to your GitHub branch → Render auto-deploys (if auto-deploy is on).

Or manually: Render dashboard → **Manual Deploy → Deploy latest commit**.

## Keep-Alive (Prevent Sleep on Free Tier)

Free web services on Render sleep after 15 min of inactivity. For a Telegram bot using polling, the bot loop itself keeps the process active. But the HTTP API port may be put to sleep.

Add a simple health-check ping using an external service like [UptimeRobot](https://uptimerobot.com) (free):
1. Sign up at uptimerobot.com
2. Add monitor: `https://chiateam-bot.onrender.com/api/status`
3. Check interval: every 5 minutes

This keeps the service alive 24/7 for free.

## Verify

```bash
curl https://chiateam-bot.onrender.com/api/status
# Expected: {"online":true,...}
```

Then send `/start` in Telegram — bot should respond.
