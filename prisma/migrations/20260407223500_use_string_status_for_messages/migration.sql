DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'status'
      AND udt_name = 'MessageStatus'
  ) THEN
    ALTER TABLE "messages"
      ALTER COLUMN "status" TYPE VARCHAR(20) USING "status"::text;
  ELSE
    ALTER TABLE "messages"
      ALTER COLUMN "status" TYPE VARCHAR(20);
  END IF;
END $$;

ALTER TABLE "messages"
  ALTER COLUMN "status" SET DEFAULT 'SENT';

DROP TYPE IF EXISTS "MessageStatus";
