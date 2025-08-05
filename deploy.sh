#!/bin/bash

# Production deployment script
# This script copies code from chiateam-dev to chiateam for production

echo "🚀 Starting production deployment..."

# Check if we're in the correct directory
if [ ! -d "chiateam-dev" ] || [ ! -d "chiateam" ]; then
    echo "❌ Error: chiateam-dev or chiateam directory not found"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Remove contents inside chiateam folder (preserve the folder itself and hidden files)
echo "🗑️  Removing old production code (preserving hidden files)..."
find chiateam -mindepth 1 -not -name ".*" -delete

# Copy new code from development to production
echo "📋 Copying new code from chiateam-dev to chiateam..."
cp -r chiateam-dev/* chiateam/

# Set the package.json name to "chiateam"
echo "🔄 Setting package.json name to 'chiateam'..."
node -e "
const pkg = require('./chiateam/package.json');
pkg.name = 'chiateam';
require('fs').writeFileSync('./chiateam/package.json', JSON.stringify(pkg, null, 2));
"
echo "✅ Package.json name set to: chiateam"

# Remove development-specific files from production
echo "🧹 Cleaning up production-specific files..."
cd chiateam

# Remove dev-specific files and directories
rm -rf db/*.db 2>/dev/null || true
rm -rf node_modules 2>/dev/null || true
rm -rf .git 2>/dev/null || true
rm -rf .gitignore 2>/dev/null || true

# Install production dependencies
echo "📦 Installing production dependencies..."
npm install --production

echo "✅ Production deployment completed!"
echo "📍 Production code is now in /chiateam"
echo "🔧 To start production bot: cd chiateam && npm start" 