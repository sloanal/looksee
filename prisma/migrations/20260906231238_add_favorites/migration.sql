-- AlterTable
ALTER TABLE "UserMediaPreference" ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "UserMediaPreference_userId_isFavorite_idx" ON "UserMediaPreference"("userId", "isFavorite");
