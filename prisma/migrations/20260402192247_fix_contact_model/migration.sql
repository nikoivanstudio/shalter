-- This migration was generated as a duplicate "create contacts" migration.
-- Keep it idempotent so deploys succeed for existing databases.
CREATE TABLE IF NOT EXISTS "contacts" (
    "id" SERIAL NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "contact_user_id" INTEGER NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contacts_contact_user_id_idx" ON "contacts"("contact_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_owner_id_contact_user_id_key" ON "contacts"("owner_id", "contact_user_id");

DO $$
BEGIN
    ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "contacts" ADD CONSTRAINT "contacts_contact_user_id_fkey" FOREIGN KEY ("contact_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
