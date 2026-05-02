CREATE TABLE "ad_campaigns" (
  "id" SERIAL NOT NULL,
  "owner_id" INTEGER NOT NULL,
  "title" VARCHAR(140) NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "cta_text" VARCHAR(60) NOT NULL,
  "target_url" VARCHAR(512) NOT NULL,
  "audience" VARCHAR(20) NOT NULL,
  "budget" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ad_campaigns_owner_id_created_at_idx"
  ON "ad_campaigns"("owner_id", "created_at");

CREATE INDEX "ad_campaigns_status_created_at_idx"
  ON "ad_campaigns"("status", "created_at");

ALTER TABLE "ad_campaigns"
  ADD CONSTRAINT "ad_campaigns_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
