#!/bin/bash

# Deployment script for ChiaTeam Bot Web UI
# This script builds the Docker image and deploys it to the production server

set -e  # Exit on any error

# Configuration
SERVER_USER="ubuntu"
SERVER_HOST="15.152.155.89"
IMAGE_NAME="chiateam-bot-web"
IMAGE_TAG="latest"
CONTAINER_NAME="chiateam-bot-web"
IMAGE_FILE="/tmp/${IMAGE_NAME}.tar"

echo "========================================="
echo "ChiaTeam Bot Web UI Deployment"
echo "========================================="
echo ""

# Step 1: Build Docker image
echo "📦 Building Docker image..."
cd web
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
cd ..

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

echo "✅ Docker image built successfully"
echo ""

# Step 2: Save Docker image to tar file
echo "💾 Saving Docker image to tar file..."
docker save -o ${IMAGE_FILE} ${IMAGE_NAME}:${IMAGE_TAG}

if [ $? -ne 0 ]; then
    echo "❌ Failed to save Docker image!"
    exit 1
fi

echo "✅ Docker image saved to ${IMAGE_FILE}"
echo ""

# Step 3: Transfer image to server
echo "📤 Transferring image to server..."
scp ${IMAGE_FILE} ${SERVER_USER}@${SERVER_HOST}:/tmp/

if [ $? -ne 0 ]; then
    echo "❌ Failed to transfer image to server!"
    rm -f ${IMAGE_FILE}
    exit 1
fi

echo "✅ Image transferred successfully"
echo ""

# Step 4: Deploy on server
echo "🚀 Deploying on server..."
ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
set -e

echo "Loading Docker image..."
docker load -i /tmp/chiateam-bot-web.tar

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

echo "Cleaning up image file..."
rm -f /tmp/chiateam-bot-web.tar

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
    rm -f ${IMAGE_FILE}
    exit 1
fi

# Cleanup local tar file
echo ""
echo "🧹 Cleaning up local files..."
rm -f ${IMAGE_FILE}

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
