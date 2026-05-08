CREATE TABLE IF NOT EXISTS "runtime_calls" (
  "id" TEXT NOT NULL,
  "dialog_id" INTEGER NOT NULL,
  "media" TEXT NOT NULL,
  "created_by_user_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "users_json" JSONB NOT NULL,
  "participants_json" JSONB NOT NULL,
  "ended_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "runtime_calls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "runtime_calls_active_dialog_idx"
  ON "runtime_calls"("dialog_id")
  WHERE "ended_at" IS NULL;

CREATE TABLE IF NOT EXISTS "runtime_call_events" (
  "sequence" BIGSERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "payload_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "runtime_call_events_pkey" PRIMARY KEY ("sequence")
);

CREATE INDEX IF NOT EXISTS "runtime_call_events_user_sequence_idx"
  ON "runtime_call_events"("user_id", "sequence");
