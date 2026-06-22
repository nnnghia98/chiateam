# Railway Deployment Setup Guide

## 🚀 Quick Start

Your project is configured for Railway deployment. Follow these steps:

## 1. Configure Environment Variables in Railway

In your Railway project dashboard, go to **Variables** tab and add these:

### Required Variables

```
NODE_ENV=production
BOT_OWNER_ID=972455114
BOT_ADMIN_IDS=972455114
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
CHAT_ID=your_chat_id_here
DEFAULT_THREAD_ID=1
MAIN_THREAD_ID=61684
ANNOUNCEMENT_THREAD_ID=61897
VIP_THREAD_ID=63171
STATISTICS_THREAD_ID=73073
API_PORT=8787
INTERNAL_API_AUTH_TOKEN=change-this-shared-internal-token
BOT_STATE_FILE=/api/data/bot/storage.json
```

### Database (Supabase PostgreSQL)

```
DATABASE_URL=postgresql://postgres.pgpdacbrwyzvwxraqwcb:chamhet@123!@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
```

### Supabase Storage (Player Avatars)

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
SUPABASE_STORAGE_BUCKET=player-avatars
```

### Optional Variables

```
GEMINI_API_KEY=your_gemini_api_key_here
ADMIN_UI_URL=your_admin_app_url_here
```

### Environment Identifier (for logging)

```
ENV_FILE=railway
```

## 2. Deploy Settings in Railway

Railway will automatically detect your Node.js project and use:

- **Build Command:** `yarn install --frozen-lockfile`
- **Start Command:** `yarn start:bot`

These are configured in `railway.json` and `Procfile`.

## 3. Database Setup

If you need to initialize the database on first deployment:

1. In Railway dashboard, open the **Deployments** tab
2. Once your service is running, click on your deployment
3. Open the **Terminal** tab in the deployment view
4. Run: `node api/db/init-database.js`

Or set up a one-time Job in Railway:

```bash
node api/db/init-database.js
```

## 4. Health Check & Monitoring

After deployment, check:

- Railway will show deployment logs
- Your bot should start and connect to Telegram
- Check logs for: `🔧 Environment file loaded: railway`

## 5. Webhook Configuration (if using API)

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
