ALTER TABLE "purchase_requests"
  ADD COLUMN "payment_provider" VARCHAR(40),
  ADD COLUMN "provider_payment_id" VARCHAR(128),
  ADD COLUMN "provider_status" VARCHAR(40),
  ADD COLUMN "paid_at" TIMESTAMP(3);

CREATE INDEX "purchase_requests_provider_payment_id_idx"
  ON "purchase_requests"("provider_payment_id");
