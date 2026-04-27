CREATE TYPE "ChannelParticipantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

CREATE TABLE "channels" (
  "id" SERIAL NOT NULL,
  "title" VARCHAR(80) NOT NULL,
  "description" VARCHAR(280),
  "owner_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel_participants" (
  "id" SERIAL NOT NULL,
  "channel_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "role" "ChannelParticipantRole" NOT NULL DEFAULT 'MEMBER',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "channel_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel_messages" (
  "id" SERIAL NOT NULL,
  "channel_id" INTEGER NOT NULL,
  "author_id" INTEGER NOT NULL,
  "content" VARCHAR(1000) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "channel_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "channels_title_idx" ON "channels"("title");
CREATE UNIQUE INDEX "channel_participants_channel_id_user_id_key" ON "channel_participants"("channel_id", "user_id");
CREATE INDEX "channel_participants_user_id_idx" ON "channel_participants"("user_id");
CREATE INDEX "channel_messages_channel_id_id_idx" ON "channel_messages"("channel_id", "id");
CREATE INDEX "channel_messages_author_id_idx" ON "channel_messages"("author_id");

ALTER TABLE "channels"
  ADD CONSTRAINT "channels_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_participants"
  ADD CONSTRAINT "channel_participants_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "channels"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_participants"
  ADD CONSTRAINT "channel_participants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_messages"
  ADD CONSTRAINT "channel_messages_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "channels"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_messages"
  ADD CONSTRAINT "channel_messages_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
