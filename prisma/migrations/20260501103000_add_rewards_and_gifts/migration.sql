ALTER TABLE "users"
ADD COLUMN "stars_balance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "partner_stars_earned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "referred_by_id" INTEGER;

ALTER TABLE "users"
ADD CONSTRAINT "users_referred_by_id_fkey"
FOREIGN KEY ("referred_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "star_transactions" (
  "id" SERIAL NOT NULL,
  "sender_id" INTEGER,
  "recipient_id" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "kind" VARCHAR(40) NOT NULL,
  "note" VARCHAR(255),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "star_transactions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "star_transactions"
ADD CONSTRAINT "star_transactions_sender_id_fkey"
FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "star_transactions"
ADD CONSTRAINT "star_transactions_recipient_id_fkey"
FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "gift_transactions" (
  "id" SERIAL NOT NULL,
  "sender_id" INTEGER,
  "recipient_id" INTEGER NOT NULL,
  "gift_key" VARCHAR(60) NOT NULL,
  "gift_name" VARCHAR(120) NOT NULL,
  "stars_spent" INTEGER NOT NULL,
  "note" VARCHAR(255),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "gift_transactions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "gift_transactions"
ADD CONSTRAINT "gift_transactions_sender_id_fkey"
FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "gift_transactions"
ADD CONSTRAINT "gift_transactions_recipient_id_fkey"
FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
