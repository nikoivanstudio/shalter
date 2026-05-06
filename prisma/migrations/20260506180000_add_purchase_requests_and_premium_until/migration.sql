ALTER TABLE "users"
ADD COLUMN "premium_until" TIMESTAMP(3);

CREATE TABLE "purchase_requests" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "reviewed_by_user_id" INTEGER,
  "product_key" VARCHAR(40) NOT NULL,
  "amount_rub" INTEGER NOT NULL,
  "premium_months" INTEGER NOT NULL DEFAULT 0,
  "stars_amount" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(20) NOT NULL,
  "note" VARCHAR(255),
  "checkout_url" VARCHAR(1024),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "purchase_requests_user_id_status_idx"
  ON "purchase_requests"("user_id", "status");

CREATE INDEX "purchase_requests_status_created_at_idx"
  ON "purchase_requests"("status", "created_at");

ALTER TABLE "purchase_requests"
  ADD CONSTRAINT "purchase_requests_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "purchase_requests"
  ADD CONSTRAINT "purchase_requests_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
