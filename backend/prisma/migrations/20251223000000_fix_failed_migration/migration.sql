-- Fix failed migration by deleting the record
DELETE FROM "_prisma_migrations"
WHERE migration_name LIKE '%people_also_ask%';

-- Ensure peopleAlsoAsk column exists (safe even if it already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Cluster' AND column_name = 'peopleAlsoAsk'
    ) THEN
        ALTER TABLE "Cluster" ADD COLUMN "peopleAlsoAsk" JSONB DEFAULT '[]';
    END IF;
END $$;
