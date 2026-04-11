CREATE TABLE "user_blacklist" (
  "id" SERIAL NOT NULL,
  "owner_id" INTEGER NOT NULL,
  "blocked_user_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_blacklist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_blacklist_owner_id_blocked_user_id_key"
  ON "user_blacklist"("owner_id", "blocked_user_id");

CREATE INDEX "user_blacklist_blocked_user_id_idx"
  ON "user_blacklist"("blocked_user_id");

ALTER TABLE "user_blacklist"
  ADD CONSTRAINT "user_blacklist_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_blacklist"
  ADD CONSTRAINT "user_blacklist_blocked_user_id_fkey"
  FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
