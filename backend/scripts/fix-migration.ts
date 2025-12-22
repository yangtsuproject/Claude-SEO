import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFailedMigration() {
  try {
    console.log('🔧 Fixing failed migration...');

    // Step 1: Mark the failed migration as rolled back
    await prisma.$executeRawUnsafe(`
      UPDATE "_prisma_migrations"
      SET rolled_back_at = NOW()
      WHERE migration_name = '20251222120000_add_people_also_ask'
      AND finished_at IS NULL;
    `);

    console.log('✅ Marked failed migration as rolled back');

    // Step 2: Check if peopleAlsoAsk column exists
    const columnExists = await prisma.$queryRawUnsafe<any[]>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Cluster' AND column_name = 'peopleAlsoAsk';
    `);

    if (columnExists.length === 0) {
      // Step 3: Add the column if it doesn't exist
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Cluster" ADD COLUMN "peopleAlsoAsk" JSONB DEFAULT '[]';
      `);
      console.log('✅ Added peopleAlsoAsk column to Cluster table');
    } else {
      console.log('✅ peopleAlsoAsk column already exists');
    }

    // Step 4: Mark the new migration as applied
    await prisma.$executeRawUnsafe(`
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

  } catch (error) {
    console.error('❌ Error fixing migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixFailedMigration();
