# ChiaTeam Bot Web UI Deployment Guide

## Deployment Summary

**Deployment Date:** March 5, 2026  
**Server:** ubuntu@15.152.155.89 (ip-10-14-43-119)  
**Status:** ✅ Successfully Deployed

## Architecture

The deployment consists of:

1. **Next.js Web UI** - Running in Docker container on port 3000
2. **Bot API Server** - Running on port 8787 (existing)
3. **Nginx Reverse Proxy** - Serving on port 80, routing traffic

```
Internet (Port 80)
    ↓
Nginx Reverse Proxy
    ↓
    ├─→ / → Next.js Container (Port 3000)
    └─→ /api → Bot API Server (Port 8787)
```

## Access Points

- **Web UI:** http://15.152.155.89
- **API Status:** http://15.152.155.89/api/status
- **Health Check:** http://15.152.155.89/api (via Nginx)

## Deployment Files Created

### Docker Configuration
- `web/Dockerfile` - Multi-stage Docker build for Next.js
- `web/.dockerignore` - Excludes unnecessary files from Docker build
- `web/.env.production` - Production environment variables
- `docker-compose.web.yml` - Docker Compose configuration

### Configuration Changes
- `web/next.config.ts` - Added `output: 'standalone'` for Docker
- `src/api/server.js` - Updated CORS to allow production domain

### Deployment Scripts
- `deploy-web.sh` - Local Docker build + deploy (requires Docker running)
- `deploy-web-remote.sh` - Remote build on server (recommended)

## Deployment Commands

### Initial Deployment
```bash
./deploy-web-remote.sh
```

### Re-deployment
```bash
./deploy-web-remote.sh
```

### View Container Logs
```bash
ssh ubuntu@15.152.155.89 'docker logs -f chiateam-bot-web'
```

### Check Container Status
```bash
ssh ubuntu@15.152.155.89 'docker ps --filter name=chiateam-bot-web'
```

### Restart Container
```bash
ssh ubuntu@15.152.155.89 'docker restart chiateam-bot-web'
```

### Check Nginx Status
```bash
ssh ubuntu@15.152.155.89 'sudo systemctl status nginx'
```

## Configuration Details

### Docker Container
- **Name:** chiateam-bot-web
- **Image:** chiateam-bot-web:latest
- **Port:** 3000:3000
- **Restart Policy:** unless-stopped
- **Environment:**
  - NODE_ENV=production
  - NEXT_PUBLIC_UI_API_BASE_URL=http://15.152.155.89

### Nginx Configuration
- **Config File:** `/etc/nginx/sites-available/chiateam-bot`
- **Enabled:** `/etc/nginx/sites-enabled/chiateam-bot`
- **Routes:**
  - `/` → http://localhost:3000 (Next.js)
  - `/api` → http://localhost:8787 (Bot API)

### CORS Settings
The bot API allows requests from:
- http://localhost:3000 (development)
- http://127.0.0.1:3000 (development)
- http://15.152.155.89 (production)

## Verification Checklist

After deployment, verify:

- [ ] Container is running: `docker ps --filter name=chiateam-bot-web`
- [ ] Web UI accessible: Visit http://15.152.155.89
- [ ] API endpoint works: Visit http://15.152.155.89/api/status
- [ ] Nginx is running: `sudo systemctl status nginx`
- [ ] No errors in logs: `docker logs chiateam-bot-web`

## Troubleshooting

### Container won't start
```bash
# Check logs
ssh ubuntu@15.152.155.89 'docker logs chiateam-bot-web'

# Restart container
ssh ubuntu@15.152.155.89 'docker restart chiateam-bot-web'
```

### Nginx errors
```bash
# Test Nginx configuration
ssh ubuntu@15.152.155.89 'sudo nginx -t'

# Reload Nginx
ssh ubuntu@15.152.155.89 'sudo systemctl reload nginx'

# View Nginx logs
ssh ubuntu@15.152.155.89 'sudo tail -f /var/log/nginx/error.log'
```

### API not responding
```bash
# Check if bot API is running
ssh ubuntu@15.152.155.89 'curl http://localhost:8787/api/status'

# Check bot process
ssh ubuntu@15.152.155.89 'pm2 list'
```

### Clear and rebuild
```bash
# Stop and remove container
ssh ubuntu@15.152.155.89 'docker stop chiateam-bot-web && docker rm chiateam-bot-web'

# Remove old image
ssh ubuntu@15.152.155.89 'docker rmi chiateam-bot-web:latest'

# Re-deploy
./deploy-web-remote.sh
```

## Security Considerations

1. **Non-root user:** Container runs as nextjs user (uid 1001)
2. **Port isolation:** Bot API (8787) not exposed externally
3. **CORS protection:** API only accepts requests from allowed origins
4. **Restart policy:** Container auto-restarts on failure

## Future Enhancements

- [ ] Add SSL/TLS certificate with Let's Encrypt
- [ ] Set up automatic backups
- [ ] Add monitoring and alerting
- [ ] Implement log rotation
- [ ] Add health check endpoints
- [ ] Set up CI/CD pipeline
- [ ] Add rate limiting
- [ ] Implement caching strategy

## Rollback Procedure

If something goes wrong:

1. Stop the current container:
   ```bash
   ssh ubuntu@15.152.155.89 'docker stop chiateam-bot-web'
   ```

2. Remove the container:
   ```bash
   ssh ubuntu@15.152.155.89 'docker rm chiateam-bot-web'
   ```

3. Use a previous image or rebuild from a previous commit

4. Restart with previous configuration

## Maintenance

### Update Dependencies
```bash
cd web
yarn upgrade
# Test locally
yarn build
# Deploy
cd ..
./deploy-web-remote.sh
```

### View System Resources
```bash
ssh ubuntu@15.152.155.89 'docker stats chiateam-bot-web --no-stream'
```

### Clean Up Old Images
```bash
ssh ubuntu@15.152.155.89 'docker image prune -a'
```

## Support

For issues or questions, check:
- Container logs: `docker logs chiateam-bot-web`
- Nginx logs: `/var/log/nginx/error.log`
- System logs: `journalctl -u nginx -n 50`
