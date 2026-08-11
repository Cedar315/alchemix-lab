CREATE TABLE "analytics_events" (
  "id" BIGSERIAL NOT NULL,
  "user_id" UUID,
  "session_id" TEXT,
  "event_name" TEXT NOT NULL,
  "page" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target" TEXT,
  "recipe_id" TEXT,
  "ingredient_ids" JSONB NOT NULL DEFAULT '[]',
  "source" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_events_user_id_idx" ON "analytics_events"("user_id");
CREATE INDEX "analytics_events_session_id_idx" ON "analytics_events"("session_id");
CREATE INDEX "analytics_events_event_name_idx" ON "analytics_events"("event_name");
CREATE INDEX "analytics_events_page_idx" ON "analytics_events"("page");
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events"("created_at");

ALTER TABLE "analytics_events"
  ADD CONSTRAINT "analytics_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
