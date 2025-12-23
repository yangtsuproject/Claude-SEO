#!/bin/bash
# Don't exit on error - we want to try all steps
set +e

echo "🚀 Starting deployment process..."
echo "📍 Current directory: $(pwd)"
echo "📋 Listing files:"
ls -la scripts/ || echo "No scripts directory found"

# Step 1: Run our fix script to ensure column exists and mark migration as resolved
echo ""
echo "🔧 Running migration fix script..."
node scripts/fix-migration.js
FIX_RESULT=$?
if [ $FIX_RESULT -eq 0 ]; then
    echo "✅ Migration fix completed successfully"
else
    echo "⚠️  Fix script failed with code $FIX_RESULT, but continuing..."
fi

# Step 2: Mark failed migration as rolled back using Prisma's built-in command
echo ""
echo "📋 Marking failed migration as rolled back using Prisma..."
npx prisma migrate resolve --rolled-back 20251222120000_add_people_also_ask
RESOLVE_RESULT=$?
if [ $RESOLVE_RESULT -eq 0 ]; then
    echo "✅ Prisma marked migration as rolled back"
else
    echo "⚠️  Prisma resolve command failed with code $RESOLVE_RESULT, continuing..."
fi

# Step 3: Deploy pending migrations
echo ""
echo "📦 Deploying migrations..."
set -e  # Now exit on error for the critical steps
npx prisma migrate deploy

# Step 4: Start the application
echo ""
echo "✅ Starting application..."
exec npm start
