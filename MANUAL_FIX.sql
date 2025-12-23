-- Manual fix for failed migration on Railway
-- Run this in Railway's database console

-- Step 1: Mark the failed migration as rolled back
UPDATE "_prisma_migrations"
SET rolled_back_at = NOW(),
    finished_at = NOW()
WHERE migration_name = '20251222120000_add_people_also_ask'
AND finished_at IS NULL;

-- Step 2: Check if peopleAlsoAsk column already exists
-- (If this returns rows, the column exists and we're good)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'Cluster' AND column_name = 'peopleAlsoAsk';

-- Step 3: Add the column if it doesn't exist
-- (This will error if column exists, which is fine - just means it's already there)
ALTER TABLE "Cluster" ADD COLUMN IF NOT EXISTS "peopleAlsoAsk" JSONB DEFAULT '[]';

-- Step 4: Verify the fix worked
SELECT migration_name, started_at, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name LIKE '%people_also_ask%'
ORDER BY started_at DESC;
