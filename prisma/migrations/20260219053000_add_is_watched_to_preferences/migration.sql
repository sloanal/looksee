-- Add explicit watched marker separate from status
ALTER TABLE "UserMediaPreference"
ADD COLUMN "isWatched" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "UserMediaPreference_isWatched_idx" ON "UserMediaPreference"("isWatched");
