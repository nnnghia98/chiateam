# ChiaTeam Admin - Deployment Guide

This guide covers deploying the ChiaTeam Admin client to various platforms.

## Environment Variables

Before deploying, ensure you have the following environment variables set:

```env
NEXT_PUBLIC_API_URL=https://your-api-server.com
```

## Deploy to Vercel

Vercel is the recommended platform for deploying Next.js applications.

### Prerequisites

- Vercel account
- GitHub/GitLab repository (optional but recommended)

### Steps

1. Install Vercel CLI:

```bash
npm install -g vercel
```

2. Navigate to the admin directory:

```bash
cd admin
```

3. Deploy:

```bash
vercel
```

4. Set environment variables in Vercel dashboard:
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add `NEXT_PUBLIC_API_URL` with your API server URL

5. Redeploy if needed:

```bash
vercel --prod
```

### GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your repository
5. Set the root directory to `admin`
6. Add environment variables
7. Deploy

## Deploy to Netlify

1. Navigate to the admin directory:

```bash
cd admin
```

2. Build the project:

```bash
npm run build
```

3. Install Netlify CLI:

```bash
npm install -g netlify-cli
```

4. Deploy:

```bash
netlify deploy --prod
```

5. Set environment variables in Netlify dashboard

## Deploy to Docker

### Create Dockerfile

Create a `Dockerfile` in the `admin` directory:

```dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8389

ENV PORT 8389

CMD ["node", "server.js"]
```

### Build and Run

```bash
cd admin
docker build -t chiateam-admin .
docker run -p 8389:8389 -e NEXT_PUBLIC_API_URL=http://your-api:8080 chiateam-admin
```

## Deploy with Docker Compose

Add the admin service to your `docker-compose.yml`:

```yaml
services:
  admin:
    build: ./admin
    ports:
      - '8389:8389'
    environment:
      - NEXT_PUBLIC_API_URL=http://api:8080
    depends_on:
      - api
```

Run:

```bash
docker-compose up -d admin
```

## Server Requirements

### Minimum Requirements

- Node.js 18 or higher
- 512MB RAM
- 1GB disk space

### Recommended

- Node.js 20 or higher
- 1GB RAM
- 2GB disk space

## Security Considerations

1. **HTTPS**: Always use HTTPS in production
2. **CORS**: Ensure your API server has proper CORS configuration
3. **Environment Variables**: Never commit `.env.local` or sensitive data
4. **Authentication**: Implement authentication if needed (currently not included)

## Performance Optimization

1. **Enable caching**: Configure proper cache headers
2. **CDN**: Use a CDN for static assets (automatic with Vercel/Netlify)
3. **Image optimization**: Use Next.js Image component for images
4. **Monitoring**: Set up monitoring with services like Vercel Analytics or Sentry

## Troubleshooting

### API Connection Issues

If the admin client can't connect to the API:

1. Check `NEXT_PUBLIC_API_URL` environment variable
2. Verify CORS settings on the API server
3. Ensure the API server is accessible from the admin client's network
4. Check browser console for detailed error messages

### Build Failures

1. Clear `.next` directory:

```bash
rm -rf .next
```

2. Clear node_modules and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

3. Check Node.js version:

```bash
node --version  # Should be 18+
```

## Monitoring and Maintenance

1. **Logs**: Monitor application logs regularly
2. **Updates**: Keep dependencies up to date
3. **Backups**: Ensure database backups are in place
4. **Testing**: Test after each deployment

## Support

For issues and questions, please refer to the main project documentation or create an issue in the GitHub repository.
