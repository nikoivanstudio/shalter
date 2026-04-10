CREATE TABLE "dialog_blocked_users" (
  "id" SERIAL NOT NULL,
  "dialog_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "blocked_by_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "dialog_blocked_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dialog_blocked_users_dialog_id_user_id_key"
  ON "dialog_blocked_users"("dialog_id", "user_id");

CREATE INDEX "dialog_blocked_users_dialog_id_idx"
  ON "dialog_blocked_users"("dialog_id");

CREATE INDEX "dialog_blocked_users_user_id_idx"
  ON "dialog_blocked_users"("user_id");

ALTER TABLE "dialog_blocked_users"
  ADD CONSTRAINT "dialog_blocked_users_dialog_id_fkey"
  FOREIGN KEY ("dialog_id") REFERENCES "dialogs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dialog_blocked_users"
  ADD CONSTRAINT "dialog_blocked_users_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dialog_blocked_users"
  ADD CONSTRAINT "dialog_blocked_users_blocked_by_id_fkey"
  FOREIGN KEY ("blocked_by_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
