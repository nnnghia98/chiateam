FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json yarn.lock ./

RUN corepack enable && yarn install --frozen-lockfile --production=true

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json yarn.lock ./
COPY bot ./bot
COPY api ./api
COPY config ./config

# Persistent bot storage is mounted to this path in docker-compose/Railway.
RUN mkdir -p /api/data/bot

EXPOSE 8787

CMD ["node", "bot/index.js"]
