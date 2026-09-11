ALTER TABLE "announcements"
ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "announcements_pinned_published_at_idx"
ON "announcements" ("pinned" DESC, "published_at" DESC);
