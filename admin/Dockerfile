FROM node:22-alpine AS deps

WORKDIR /app

COPY admin/package.json admin/yarn.lock ./

RUN corepack enable && yarn install --frozen-lockfile

FROM node:22-alpine AS builder

WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY admin/ ./

RUN corepack enable && yarn build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8389

COPY --from=builder /app ./

EXPOSE 8389

CMD ["node_modules/.bin/next", "start", "-p", "8389"]
