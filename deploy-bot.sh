#!/bin/bash

# Bot Backend Deployment Script
# Deploys the bot code to production server via git pull

set -e

SERVER_USER="ubuntu"
SERVER_HOST="15.152.155.89"
BOT_DIR="/var/www/chiateam"
BRANCH="nghia/dev"

echo "========================================="
echo "ChiaTeam Bot Backend Deployment"
echo "========================================="
echo ""

echo "📤 Pushing local changes to git..."
git push origin ${BRANCH}

echo ""
echo "🚀 Deploying to server..."

ssh ${SERVER_USER}@${SERVER_HOST} << ENDSSH
set -e

echo "📂 Navigating to bot directory..."
cd ${BOT_DIR}

echo "📥 Pulling latest code from git..."
git fetch origin
git checkout ${BRANCH}
git pull origin ${BRANCH}

echo "📦 Installing dependencies..."
yarn install --frozen-lockfile

echo "🔄 Restarting bot via PM2..."
pm2 restart chiateam

echo "⏳ Waiting for bot to start..."
sleep 3

echo ""
echo "✅ Deployment completed!"
echo ""
echo "📊 Bot status:"
pm2 list chiateam

echo ""
echo "📝 Recent logs:"
pm2 logs chiateam --lines 20 --nostream

echo ""
echo "🔍 API health check:"
curl -s http://localhost:8787/api/status | head -20
ENDSSH

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "✅ Deployment successful!"
    echo "========================================="
    echo ""
    echo "🌐 Bot API: http://${SERVER_HOST}/api/status"
    echo "🌐 Web UI: http://${SERVER_HOST}"
    echo ""
    echo "To view logs:"
    echo "  ssh ${SERVER_USER}@${SERVER_HOST} 'pm2 logs chiateam'"
    echo ""
else
    echo ""
    echo "❌ Deployment failed!"
    exit 1
fi
