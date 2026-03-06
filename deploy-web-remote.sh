#!/bin/bash

# Alternative deployment script - builds on server
# This script transfers source code and builds on the production server

set -e  # Exit on any error

# Configuration
SERVER_USER="ubuntu"
SERVER_HOST="15.152.155.89"
CONTAINER_NAME="chiateam-bot-web"
DEPLOY_DIR="/home/ubuntu/chiateam-bot-web"

echo "========================================="
echo "ChiaTeam Bot Web UI Deployment"
echo "========================================="
echo ""

# Step 1: Create deployment archive
echo "📦 Creating deployment archive..."
cd web
tar -czf /tmp/web-app.tar.gz \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    .
cd ..

if [ $? -ne 0 ]; then
    echo "❌ Failed to create archive!"
    exit 1
fi

echo "✅ Archive created successfully"
echo ""

# Step 2: Transfer archive to server
echo "📤 Transferring code to server..."
scp /tmp/web-app.tar.gz ${SERVER_USER}@${SERVER_HOST}:/tmp/

if [ $? -ne 0 ]; then
    echo "❌ Failed to transfer archive to server!"
    rm -f /tmp/web-app.tar.gz
    exit 1
fi

echo "✅ Code transferred successfully"
echo ""

# Step 3: Deploy on server
echo "🚀 Deploying on server..."
ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
set -e

DEPLOY_DIR="/home/ubuntu/chiateam-bot-web"

echo "Creating deployment directory..."
mkdir -p ${DEPLOY_DIR}

echo "Extracting code..."
cd ${DEPLOY_DIR}
tar -xzf /tmp/web-app.tar.gz
rm -f /tmp/web-app.tar.gz

echo "Building Docker image..."
docker build -t chiateam-bot-web:latest .

echo "Stopping and removing old container..."
docker stop chiateam-bot-web 2>/dev/null || true
docker rm chiateam-bot-web 2>/dev/null || true

echo "Starting new container..."
docker run -d \
  --name chiateam-bot-web \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_UI_API_BASE_URL=http://15.152.155.89 \
  chiateam-bot-web:latest

echo "Checking if Nginx is installed..."
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    sudo apt-get update
    sudo apt-get install -y nginx
fi

echo "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/chiateam-bot > /dev/null << 'EOF'
server {
    listen 80;
    server_name 15.152.155.89;

    # Increased client body size for uploads
    client_max_body_size 10M;

    # Proxy to Next.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy API requests to bot API server
    location /api {
        proxy_pass http://localhost:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

echo "Enabling Nginx site..."
sudo ln -sf /etc/nginx/sites-available/chiateam-bot /etc/nginx/sites-enabled/

echo "Disabling default site if exists..."
sudo rm -f /etc/nginx/sites-enabled/default

echo "Testing Nginx configuration..."
sudo nginx -t

echo "Reloading Nginx..."
sudo systemctl reload nginx

echo "Ensuring Nginx is enabled and running..."
sudo systemctl enable nginx
sudo systemctl restart nginx

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "Container status:"
docker ps --filter name=chiateam-bot-web

echo ""
echo "Container logs (last 20 lines):"
docker logs --tail 20 chiateam-bot-web
ENDSSH

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed!"
    rm -f /tmp/web-app.tar.gz
    exit 1
fi

# Cleanup local archive
echo ""
echo "🧹 Cleaning up local files..."
rm -f /tmp/web-app.tar.gz

echo ""
echo "========================================="
echo "✅ Deployment completed successfully!"
echo "========================================="
echo ""
echo "🌐 Web UI should be accessible at: http://${SERVER_HOST}"
echo "🔍 API endpoint: http://${SERVER_HOST}/api/status"
echo ""
echo "To view logs, run:"
echo "  ssh ${SERVER_USER}@${SERVER_HOST} 'docker logs -f ${CONTAINER_NAME}'"
echo ""
