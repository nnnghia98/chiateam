# Railway Deployment Setup Guide

## 🚀 Quick Start

Your project is configured for Railway deployment. Follow these steps:

## 1. Configure Environment Variables in Railway

In your Railway project dashboard, go to **Variables** tab and add these:

### Required Variables

```
NODE_ENV=production
BOT_OWNER_ID=your_bot_owner_id
BOT_ADMIN_IDS=your_admin_id_1,your_admin_id_2
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ZALO_BOT_TOKEN=your_zalo_bot_token
# ZALO_BOT_OWNER_ID remains a Zalo admin identity, not a broadcast destination.
CHAT_ID=your_chat_id
DEFAULT_THREAD_ID=
MAIN_THREAD_ID=your_main_thread_id
ANNOUNCEMENT_THREAD_ID=your_announcement_thread_id
VIP_THREAD_ID=your_vip_thread_id
STATISTICS_THREAD_ID=your_statistics_thread_id
API_PORT=8787
INTERNAL_API_AUTH_TOKEN=replace_with_a_random_secret
```

### Database (Supabase PostgreSQL)

```
DATABASE_URL=postgresql://postgres:[password].[project-ref].supabase.co:5432/postgres
```

### Supabase Storage (Player Avatars)

```
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_STORAGE_BUCKET=player-avatars
```

### Optional Variables

```
GEMINI_API_KEY=your_gemini_api_key
ADMIN_UI_URL=https://admin.example.com
```

## 2. Deploy Settings in Railway

For Telegram-to-Zalo subscriber announcements, deploy the API and the Zalo
webhook as well as the Telegram bot. See [broadcast setup](ZALO_BROADCAST.md).
The existing `ZALO_BOT_TOKEN` on the Telegram bot service authorizes sends.

Railway will automatically detect your Node.js project and use:

- **Build Command:** `yarn install --frozen-lockfile`
- **Start Command:** `yarn start:bot`

These are configured in `railway.json` and `Procfile`.

## 3. Persistent Bot Storage

The API stores next-match state only in PostgreSQL table `storage`.
`DATABASE_URL` is required. No volume is needed for bot state. Missing database
configuration and database failures produce errors, without a file fallback.
Existing JSON files and volumes are not deleted; keep them as archives.

Run this once after deploying database-related changes:

```bash
yarn init-db
```

Back up PostgreSQL through your database provider before risky rollouts.

## 4. Database Setup

If you need to initialize the database on first deployment:

1. In Railway dashboard, open the **Deployments** tab
2. Once your service is running, click on your deployment
3. Open the **Terminal** tab in the deployment view
4. Run: `node api/db/init-database.js`

Or set up a one-time Job in Railway:

```bash
node api/db/init-database.js
```

## 5. Health Check & Monitoring

After deployment, check:

- Railway will show deployment logs
- Your bot should start and connect to Telegram
- Check logs for startup errors or missing required variables

## 6. Webhook Configuration (if using API)

If you're also deploying the API server, you'll need to:

1. Create a separate Railway service for the API
2. Set the start command to: `node api/index.js`
3. Expose the API_PORT (default: 8787)
4. Update your webhook URLs in Telegram bot settings

## 🔄 Redeployment

Railway automatically redeploys when you push to your connected Git repository.

Manual redeploy:

- Click **Deploy** in your Railway dashboard

## 📝 Files Created for Railway

- `Procfile` - Tells Railway how to start your app
- `railway.json` - Railway configuration with build and deploy settings
- `RAILWAY_SETUP.md` - This guide

## 🐛 Troubleshooting

### Bot not starting?

1. Check deployment logs in Railway
2. Verify all environment variables are set
3. Check TELEGRAM_BOT_TOKEN is correct

### Database connection issues?

1. Verify DATABASE_URL is correct
2. Check if Supabase database is accessible
3. Ensure database has been initialized

### Port issues?

Railway automatically assigns a PORT environment variable. If you need to expose the API:

- Make sure `api/index.js` uses `process.env.PORT || API_PORT`
- Enable "Public Networking" in Railway service settings

## 📊 Multiple Services Setup

If you want to deploy both Bot and API separately:

### Service 1: Bot

- Start Command: `yarn start:bot`
- No public port needed (unless webhook mode)

### Service 2: API

- Start Command: `yarn start:api`
- Enable public networking
- Port: 4000 (or use Railway's PORT)

### Service 3: Admin UI (Optional)

Admin UI has been split into a separate repository.

- Repo/location: `../chiateam-admin`
- Deploy it as an independent Railway/Vercel service
- Configure `API_INTERNAL_URL` and `INTERNAL_API_AUTH_TOKEN` to point to this API service

## 🎯 Current Configuration

Your project is set up to run the **Telegram Bot** by default.
The bot will:

- Load environment variables from Railway
- Connect to your Telegram bot
- Use Supabase PostgreSQL database
- Run in production mode

## Next Steps

1. ✅ Set all environment variables in Railway
2. ✅ Deploy the project
3. ✅ Check deployment logs
4. ✅ Test your bot in Telegram
5. ✅ Initialize database if needed
