-- CreateTable
CREATE TABLE "MediaItemRoom" (
    "id" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "addedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaItemRoom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaItemRoom_mediaItemId_roomId_key" ON "MediaItemRoom"("mediaItemId", "roomId");

-- CreateIndex
CREATE INDEX "MediaItemRoom_mediaItemId_idx" ON "MediaItemRoom"("mediaItemId");

-- CreateIndex
CREATE INDEX "MediaItemRoom_roomId_idx" ON "MediaItemRoom"("roomId");

-- CreateIndex
CREATE INDEX "MediaItemRoom_addedByUserId_idx" ON "MediaItemRoom"("addedByUserId");

-- AddForeignKey
ALTER TABLE "MediaItemRoom" ADD CONSTRAINT "MediaItemRoom_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaItemRoom" ADD CONSTRAINT "MediaItemRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaItemRoom" ADD CONSTRAINT "MediaItemRoom_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate existing data: Create MediaItemRoom entries for all existing MediaItems
INSERT INTO "MediaItemRoom" ("id", "mediaItemId", "roomId", "addedByUserId", "createdAt")
SELECT 
    gen_random_uuid()::text,
    "id" as "mediaItemId",
    "roomId",
    "createdByUserId" as "addedByUserId",
    "createdAt"
FROM "MediaItem";
