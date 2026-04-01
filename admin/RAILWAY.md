# Railway Deployment - Admin Service

## Quick Setup

1. In Railway Dashboard, click **"+ New"** → **"Service"**
2. Select your GitHub repository
3. After service is created, go to **Settings**
4. Under **General** → **Root Directory**, enter: `admin`
5. Railway will automatically use `admin/railway.json` and `admin/nixpacks.toml`

## Environment Variables

Add these in Railway service settings (Variables tab):

```
NEXT_PUBLIC_API_URL=https://your-bot-service.railway.app
NEXT_PUBLIC_ADMIN_PASSWORD=your-secure-password
NEXT_PUBLIC_VIEWER_PASSWORD=your-viewer-password
```

## Monorepo Structure

```
chiateam-bot/
├── railway.json          ← Used by BOT service
├── bot/                  ← Bot code
├── api/                  ← API code
└── admin/
    ├── railway.json      ← Used by ADMIN service (when root dir = "admin")
    ├── nixpacks.toml     ← Build config
    └── src/              ← Admin code
```

## Service Configuration

**Bot Service:**
- Root Directory: `.` (or empty)
- Start Command: `node bot/index.js`

**Admin Service:**
- Root Directory: `admin`
- Start Command: `yarn start`
- Build Command: Auto-detected from `railway.json`

## Testing Deployment

After deployment, your admin should be accessible at:
`https://chiateam-admin-production.up.railway.app`

Make sure to update API CORS to allow this domain!
