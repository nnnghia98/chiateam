## Sprint 7 – Production Web UI Deployment (chiateam-bot)

**Period**: 2026, Sprint 7  
**Area**: Deploy Next.js web UI to production server with Docker and Nginx

### Goals

- Deploy the Next.js web UI to the production server (ubuntu@15.152.155.89) running the bot.
- Set up proper infrastructure with Docker containerization and Nginx reverse proxy.
- Ensure the web UI can communicate with the existing bot API server.
- Make the web console accessible via HTTP on port 80.

### Key Changes

- **Docker containerization** (`web/Dockerfile`, `web/.dockerignore`, `docker-compose.web.yml`):
  - Created multi-stage Dockerfile for optimized Next.js production builds.
  - Build stage: Installs dependencies and builds the Next.js application.
  - Runner stage: Minimal Node.js Alpine image with only production artifacts.
  - Configured Next.js with `output: 'standalone'` for Docker compatibility.
  - Container runs as non-root user (nextjs:1001) for security.
  - Exposes port 3000 internally.
  - **Impact**: Web UI now runs in an isolated, reproducible container environment with minimal attack surface.

- **Production configuration** (`web/.env.production`, `web/next.config.ts`):
  - Set `NEXT_PUBLIC_UI_API_BASE_URL=http://15.152.155.89` for production API calls.
  - Enabled standalone output mode in Next.js config for Docker deployments.
  - **Impact**: Web UI correctly connects to the production bot API server.

- **CORS updates** (`src/api/server.js`):
  - Added `http://15.152.155.89` to the CORS allowlist.
  - Added DELETE method to allowed CORS methods for future player management features.
  - Kept existing localhost entries for local development.
  - **Impact**: Browser requests from the production domain are now accepted by the API.

- **Nginx reverse proxy setup** (deployed via `deploy-web-remote.sh`):
  - Installed and configured Nginx on the production server.
  - Created `/etc/nginx/sites-available/chiateam-bot` configuration.
  - Routes:
    - `/` → Next.js container (localhost:3000)
    - `/api` → Bot API server (localhost:8787)
  - Disabled default Nginx site.
  - **Impact**: Single entry point on port 80 for both web UI and API, with proper routing and proxy headers.

- **Automated deployment** (`deploy-web.sh`, `deploy-web-remote.sh`):
  - Created two deployment scripts:
    - `deploy-web.sh`: Builds Docker image locally and transfers to server (requires local Docker).
    - `deploy-web-remote.sh`: Transfers source code and builds on server (recommended approach).
  - Deployment process:
    1. Creates tarball of web application source code.
    2. Transfers to server via SCP.
    3. Builds Docker image on server.
    4. Stops old container and starts new one.
    5. Configures and reloads Nginx.
    6. Verifies deployment success.
  - **Impact**: One-command deployment process with automatic rollout and verification.

- **Deployment documentation** (`DEPLOYMENT.md`):
  - Comprehensive deployment guide with architecture diagrams.
  - Step-by-step deployment instructions.
  - Troubleshooting procedures.
  - Maintenance commands and rollback procedures.
  - Future enhancement recommendations (SSL, monitoring, CI/CD).
  - **Impact**: Clear documentation for future deployments and maintenance.

### Technical Details

- **Architecture**:
  - Browser → Nginx (port 80) → Next.js (port 3000) or Bot API (port 8787)
  - Bot API (port 8787) not exposed externally, only accessible via Nginx proxy.
  - All services running on the same server (ubuntu@15.152.155.89).

- **Docker setup**:
  - Image: `chiateam-bot-web:latest`
  - Container name: `chiateam-bot-web`
  - Restart policy: `unless-stopped` (auto-restarts on failure)
  - Port mapping: 3000:3000
  - Health check: HTTP GET to localhost:3000

- **Nginx configuration**:
  - Serves as reverse proxy for both web UI and API.
  - Sets proper proxy headers (X-Real-IP, X-Forwarded-For, X-Forwarded-Proto).
  - Handles WebSocket upgrades for Next.js HMR (useful for future dev environments).
  - 10MB client body size limit for uploads.

### Deployment Verification

All services verified and operational:
- ✅ Docker container running (chiateam-bot-web)
- ✅ Next.js server responding (HTTP 200)
- ✅ API endpoints accessible via Nginx proxy
- ✅ Nginx active and serving traffic on port 80
- ✅ No errors in container or Nginx logs
- ✅ Web UI accessible at http://15.152.155.89
- ✅ API accessible at http://15.152.155.89/api/status

### Impact

- **Production-ready web console**: The web UI is now accessible to users on the internet at http://15.152.155.89.
- **Simplified operations**: Single server hosts bot, API, and web UI with proper isolation via containers.
- **Easy redeployment**: One-command deployment script allows quick updates after code changes.
- **Infrastructure foundation**: Docker and Nginx setup provides foundation for future features (SSL, load balancing, multiple environments).
- **Security improvements**: Bot API no longer exposed directly, only via Nginx proxy with controlled access.

### Files Created

**Docker & Configuration**:
- `web/Dockerfile` – Multi-stage Docker build for Next.js
- `web/.dockerignore` – Build exclusions
- `web/.env.production` – Production environment variables
- `docker-compose.web.yml` – Docker Compose configuration

**Deployment**:
- `deploy-web.sh` – Local build deployment script
- `deploy-web-remote.sh` – Remote build deployment script (used)
- `DEPLOYMENT.md` – Complete deployment documentation

**Server Files** (created during deployment):
- `/etc/nginx/sites-available/chiateam-bot` – Nginx configuration
- `/home/ubuntu/chiateam-bot-web/` – Deployment directory

### Files Modified

**Configuration**:
- `web/next.config.ts` – Added standalone output mode
- `src/api/server.js` – Updated CORS allowlist for production domain

### Future Enhancements

- Add SSL/TLS certificate with Let's Encrypt for HTTPS
- Set up custom domain name instead of IP address
- Implement automated backups for SQLite database
- Add monitoring and alerting (Prometheus/Grafana)
- Set up CI/CD pipeline for automated deployments
- Configure log rotation for Docker containers
- Add rate limiting and additional security headers
- Implement staging environment for testing
