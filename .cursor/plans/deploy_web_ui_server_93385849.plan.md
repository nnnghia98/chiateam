---
name: Deploy Web UI Server
overview: Deploy the Next.js web UI to the Ubuntu server using Docker and Nginx, connecting it to the existing bot API running on port 8787.
todos:
  - id: create-dockerfile
    content: Create web/Dockerfile with multi-stage build for Next.js
    status: completed
  - id: create-dockerignore
    content: Create web/.dockerignore to exclude unnecessary files
    status: completed
  - id: create-env-production
    content: Create web/.env.production with API base URL
    status: completed
  - id: update-cors
    content: Update CORS allowlist in src/api/server.js for production
    status: completed
  - id: create-docker-compose
    content: Create docker-compose.web.yml configuration
    status: completed
  - id: create-deploy-script
    content: Create deploy-web.sh automation script
    status: completed
  - id: test-deployment
    content: Execute deployment and verify web UI is accessible
    status: completed
isProject: false
---

# Deploy Web UI to Production Server

## Current State Analysis

The project consists of:

- **Bot Backend**: Telegram bot with HTTP API server (`[src/api/server.js](src/api/server.js)`) running on port 8787
- **Web UI**: Next.js application (`[web/](web/)`) that connects to the API via `NEXT_PUBLIC_UI_API_BASE_URL`
- **Server**: Ubuntu instance at 15.152.155.89 with Docker, running peernode containers and node_exporter

## Architecture Overview

```mermaid
graph TB
    User[User Browser]
    Nginx[Nginx :80/:443]
    NextJS[Next.js Container :3000]
    BotAPI[Bot API :8787]
    Bot[Telegram Bot]
    DB[(SQLite DB)]

    User -->|HTTP/HTTPS| Nginx
    Nginx -->|Proxy /api| BotAPI
    Nginx -->|Proxy /| NextJS
    NextJS -->|Fetch API| BotAPI
    BotAPI --> DB
    Bot --> DB

    subgraph Server[ubuntu@15.152.155.89]
        Nginx
        NextJS
        BotAPI
        Bot
        DB
    end
```

## Deployment Steps

### 1. Create Dockerfile for Next.js Web UI

Create `[web/Dockerfile](web/Dockerfile)` with multi-stage build:

- Build stage: Install dependencies and build Next.js app
- Production stage: Minimal Node.js runtime with built artifacts
- Expose port 3000
- Use non-root user for security

### 2. Add Docker Ignore File

Create `[web/.dockerignore](web/.dockerignore)` to exclude:

- `node_modules/`, `.next/`, `.git/`
- Development files, test files, and local environment files

### 3. Configure Environment Variables

Create `[web/.env.production](web/.env.production)`:

- Set `NEXT_PUBLIC_UI_API_BASE_URL=http://localhost:8787` (for server-side internal communication)
- This will be used during Docker build

### 4. Update API Server CORS Settings

Modify `[src/api/server.js](src/api/server.js)` CORS allowlist (lines 56-59):

- Add production domain/IP to allowed origins
- Add `http://15.152.155.89` and Nginx proxy headers support
- Keep existing localhost entries for local development

### 5. Create Docker Compose Configuration

Create `[docker-compose.web.yml](docker-compose.web.yml)` at project root:

- Define web service using the Dockerfile
- Set environment variables
- Map port 3000
- Configure restart policy
- Add health check

### 6. Create Nginx Configuration

Create deployment script that will:

- Install Nginx on the server
- Create Nginx configuration at `/etc/nginx/sites-available/chiateam-bot`
- Configure reverse proxy:
  - `/` → Next.js container (port 3000)
  - `/api/*` → Bot API (port 8787)
- Enable site and reload Nginx

### 7. Create Deployment Script

Create `[deploy-web.sh](deploy-web.sh)` script to:

1. Build Docker image locally
2. Save image as tar file
3. SCP image to server
4. SSH to server and load image
5. Stop old container, start new one
6. Configure and restart Nginx
7. Verify deployment

### 8. Test Deployment

Verification steps:

- Check web UI accessible at `http://15.152.155.89`
- Verify API endpoints work (`http://15.152.155.89/api/status`)
- Test player management features
- Check container logs for errors

## Key Configuration Details

**API Base URL Flow:**

- Client-side requests: Browser → Nginx → Bot API (port 8787)
- Server-side requests: Next.js container → localhost:8787 (internal)

**CORS Configuration:**
The bot API needs to allow requests from:

- `http://15.152.155.89` (Nginx proxy)
- `http://localhost:3000` (development)

**Port Mapping:**

- 80 (external) → Nginx → 3000 (Next.js) or 8787 (API)
- 8787 (internal) → Bot API server
- 3000 (internal) → Next.js container

**Security Considerations:**

- Bot API (port 8787) not exposed externally, only via Nginx proxy
- Next.js runs as non-root user in container
- Nginx handles SSL termination (can add Let's Encrypt later)

## Files to Create/Modify

**New Files:**

- `web/Dockerfile` - Container definition for Next.js app
- `web/.dockerignore` - Docker build exclusions
- `web/.env.production` - Production environment variables
- `docker-compose.web.yml` - Docker Compose configuration
- `deploy-web.sh` - Automated deployment script
- Nginx config (created via deployment script on server)

**Modified Files:**

- `src/api/server.js` - Update CORS allowlist for production domain

## Post-Deployment Tasks

- Monitor container logs: `docker logs -f <container-name>`
- Set up log rotation for containers
- Consider adding SSL certificate with Let's Encrypt
- Set up monitoring/alerting for web service
- Document rollback procedure
