-- CreateTable
CREATE TABLE "contacts" (
    "id" SERIAL NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "contact_user_id" INTEGER NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_owner_id_contact_user_id_key" ON "contacts"("owner_id", "contact_user_id");

-- CreateIndex
CREATE INDEX "contacts_contact_user_id_idx" ON "contacts"("contact_user_id");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_contact_user_id_fkey" FOREIGN KEY ("contact_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
