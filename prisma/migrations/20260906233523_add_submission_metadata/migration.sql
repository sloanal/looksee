-- AlterTable
ALTER TABLE "MediaItemRoom" ADD COLUMN     "sourceMeta" JSONB;

-- AlterTable
ALTER TABLE "UserMediaPreference" ADD COLUMN     "ratedAt" TIMESTAMP(3);

-- Backfill: every pre-existing preference was created by an explicit rating
-- (there was no favorite-only path before this migration). UserMediaPreference
-- has no createdAt column, so updatedAt is the best available rating time.
UPDATE "UserMediaPreference"
SET "ratedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "ratedAt" IS NULL;
