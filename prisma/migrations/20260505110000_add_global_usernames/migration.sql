ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" VARCHAR(32);
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "username" VARCHAR(32);
ALTER TABLE "bot_publications" ADD COLUMN IF NOT EXISTS "username" VARCHAR(32);

CREATE TABLE IF NOT EXISTS "username_registry" (
  "id" SERIAL PRIMARY KEY,
  "username" VARCHAR(32) NOT NULL,
  "entity_type" VARCHAR(20) NOT NULL,
  "entity_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "username_registry_username_key" ON "username_registry"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "username_registry_entity_type_entity_id_key" ON "username_registry"("entity_type", "entity_id");

CREATE OR REPLACE FUNCTION shalter_normalize_username(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  value TEXT;
BEGIN
  value := lower(coalesce(input_text, ''));
  value := regexp_replace(value, '[^a-z0-9_]+', '_', 'g');
  value := regexp_replace(value, '_+', '_', 'g');
  value := regexp_replace(value, '^_+|_+$', '', 'g');
  IF length(value) < 4 THEN
    value := '';
  END IF;
  RETURN left(value, 32);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION shalter_allocate_username(base_text TEXT, fallback_prefix TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized TEXT;
  candidate TEXT;
  suffix INTEGER := 0;
BEGIN
  normalized := shalter_normalize_username(base_text);
  IF normalized = '' THEN
    normalized := fallback_prefix;
  END IF;

  LOOP
    candidate := normalized;
    IF suffix > 0 THEN
      candidate := left(normalized, 32 - length(suffix::TEXT) - 1) || '_' || suffix::TEXT;
    END IF;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM "username_registry" WHERE "username" = candidate
    );

    suffix := suffix + 1;
  END LOOP;

  RETURN candidate;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  user_row RECORD;
  channel_row RECORD;
  bot_row RECORD;
  candidate TEXT;
BEGIN
  FOR user_row IN SELECT id, first_name, last_name FROM "users" WHERE "username" IS NULL ORDER BY id LOOP
    candidate := shalter_allocate_username(
      trim(concat_ws('_', user_row.first_name, user_row.last_name)),
      'user_' || user_row.id::TEXT
    );
    UPDATE "users" SET "username" = candidate WHERE id = user_row.id;
    INSERT INTO "username_registry" ("username", "entity_type", "entity_id")
    VALUES (candidate, 'user', user_row.id)
    ON CONFLICT ("username") DO NOTHING;
  END LOOP;

  FOR channel_row IN SELECT id, title FROM "channels" WHERE "username" IS NULL ORDER BY id LOOP
    candidate := shalter_allocate_username(channel_row.title, 'channel_' || channel_row.id::TEXT);
    UPDATE "channels" SET "username" = candidate WHERE id = channel_row.id;
    INSERT INTO "username_registry" ("username", "entity_type", "entity_id")
    VALUES (candidate, 'channel', channel_row.id)
    ON CONFLICT ("username") DO NOTHING;
  END LOOP;

  FOR bot_row IN SELECT id, name FROM "bot_publications" WHERE "username" IS NULL ORDER BY id LOOP
    candidate := shalter_allocate_username(bot_row.name, 'bot_' || bot_row.id::TEXT);
    UPDATE "bot_publications" SET "username" = candidate WHERE id = bot_row.id;
    INSERT INTO "username_registry" ("username", "entity_type", "entity_id")
    VALUES (candidate, 'bot', bot_row.id)
    ON CONFLICT ("username") DO NOTHING;
  END LOOP;
END $$;

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "channels" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "bot_publications" ALTER COLUMN "username" SET NOT NULL;

ALTER TABLE "users" ADD CONSTRAINT "users_username_key" UNIQUE ("username");
ALTER TABLE "channels" ADD CONSTRAINT "channels_username_key" UNIQUE ("username");
ALTER TABLE "bot_publications" ADD CONSTRAINT "bot_publications_username_key" UNIQUE ("username");

DROP FUNCTION IF EXISTS shalter_allocate_username(TEXT, TEXT);
DROP FUNCTION IF EXISTS shalter_normalize_username(TEXT);
