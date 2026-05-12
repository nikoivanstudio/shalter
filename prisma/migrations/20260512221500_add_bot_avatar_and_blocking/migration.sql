ALTER TABLE "bot_publications"
ADD COLUMN "avatar_url" VARCHAR(512),
ADD COLUMN "is_blocked" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "bot_publications_is_blocked_published_at_idx"
ON "bot_publications" ("is_blocked", "published_at" DESC);
