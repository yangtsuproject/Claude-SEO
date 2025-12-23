// Log immediately to verify script is running
console.log('='.repeat(60));
console.log('MIGRATION FIX SCRIPT STARTED');
console.log('='.repeat(60));

const { Client } = require('pg');
require('dotenv').config();

async function fixFailedMigration() {
  console.log('🚀 Starting migration fix script...');
  console.log('📍 DATABASE_URL configured:', process.env.DATABASE_URL ? 'Yes' : 'No');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database successfully');

    // Step 1: Check current migration status
    console.log('📋 Checking current migration status...');
    const currentStatus = await client.query(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE migration_name = '20251222120000_add_people_also_ask';
    `);
    console.log('Current status:', currentStatus.rows);

    // Step 2: Mark the failed migration as rolled back
    console.log('🔄 Marking failed migration as rolled back...');
    const updateResult = await client.query(`
      UPDATE "_prisma_migrations"
      SET rolled_back_at = NOW()
      WHERE migration_name = '20251222120000_add_people_also_ask'
      AND finished_at IS NULL;
    `);

    console.log(`✅ Updated ${updateResult.rowCount} migration record(s)`);

    // Step 2: Check if peopleAlsoAsk column exists
    const columnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Cluster' AND column_name = 'peopleAlsoAsk';
    `);

    if (columnCheck.rows.length === 0) {
      // Step 3: Add the column if it doesn't exist
      await client.query(`
        ALTER TABLE "Cluster" ADD COLUMN "peopleAlsoAsk" JSONB DEFAULT '[]';
      `);
      console.log('✅ Added peopleAlsoAsk column to Cluster table');
    } else {
      console.log('✅ peopleAlsoAsk column already exists');
    }

    // Step 4: Mark the new migration as applied
    await client.query(`
      INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        gen_random_uuid(),
        'manual_fix',
        NOW(),
        '20251222135200_add_people_also_ask',
        NULL,
        NULL,
        NOW(),
        1
      )
      ON CONFLICT (migration_name) DO NOTHING;
    `);

    console.log('✅ Marked new migration as applied');
    console.log('🎉 Migration fix completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error fixing migration:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixFailedMigration();
