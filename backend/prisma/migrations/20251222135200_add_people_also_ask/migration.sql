-- Add peopleAlsoAsk column to Cluster table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Cluster' AND column_name = 'peopleAlsoAsk'
    ) THEN
        ALTER TABLE "Cluster" ADD COLUMN "peopleAlsoAsk" JSONB DEFAULT '[]';
    END IF;
END $$;
