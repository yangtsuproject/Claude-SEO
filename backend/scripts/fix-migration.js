const { Client } = require('pg');
require('dotenv').config();

async function fixFailedMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    // Delete any failed migration records
    const deleteResult = await client.query(`
      DELETE FROM "_prisma_migrations"
      WHERE migration_name LIKE '%people_also_ask%';
    `);

    if (deleteResult.rowCount > 0) {
      console.log(`✅ Cleaned up ${deleteResult.rowCount} failed migration(s)`);
    }

    // Ensure peopleAlsoAsk column exists
    const columnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Cluster' AND column_name = 'peopleAlsoAsk';
    `);

    if (columnCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE "Cluster" ADD COLUMN "peopleAlsoAsk" JSONB DEFAULT '[]';
      `);
    }

    process.exit(0);

  } catch (error) {
    console.error('Migration fix error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixFailedMigration();
