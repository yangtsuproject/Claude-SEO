#!/bin/bash
set -e

echo "🚀 Starting deployment process..."

# Step 1: Mark failed migration as rolled back using Prisma's built-in command
echo "📋 Marking failed migration as rolled back..."
npx prisma migrate resolve --rolled-back 20251222120000_add_people_also_ask || echo "⚠️  Migration already resolved or not found, continuing..."

# Step 2: Run our fix script to ensure column exists
echo "🔧 Running migration fix script..."
node scripts/fix-migration.js || echo "⚠️  Fix script encountered an issue, continuing..."

# Step 3: Deploy pending migrations
echo "📦 Deploying migrations..."
npx prisma migrate deploy

# Step 4: Start the application
echo "✅ Starting application..."
npm start
