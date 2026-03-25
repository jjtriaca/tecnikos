-- AlterTable: ServiceOrderItem.quantity Int -> Float (supports decimal quantities like 2.5 diárias)
-- Applied to all tenant schemas

DO $$
DECLARE
  schema_name TEXT;
BEGIN
  FOR schema_name IN
    SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant_%' OR nspname = 'public'
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = schema_name AND table_name = 'ServiceOrderItem'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I."ServiceOrderItem" ALTER COLUMN "quantity" TYPE DOUBLE PRECISION USING "quantity"::DOUBLE PRECISION',
        schema_name
      );
    END IF;
  END LOOP;
END $$;
