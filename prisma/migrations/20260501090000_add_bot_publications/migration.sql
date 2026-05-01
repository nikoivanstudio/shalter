CREATE TABLE "bot_publications" (
  "id" SERIAL NOT NULL,
  "owner_id" INTEGER NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "niche" VARCHAR(120),
  "audience" VARCHAR(20) NOT NULL,
  "config" JSONB NOT NULL,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bot_publications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bot_publications_owner_id_published_at_idx"
  ON "bot_publications"("owner_id", "published_at");

ALTER TABLE "bot_publications"
  ADD CONSTRAINT "bot_publications_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
