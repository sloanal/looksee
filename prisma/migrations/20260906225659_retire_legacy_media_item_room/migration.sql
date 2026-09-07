-- DropForeignKey
ALTER TABLE "MediaItem" DROP CONSTRAINT "MediaItem_roomId_fkey";

-- AlterTable
ALTER TABLE "MediaItem" ALTER COLUMN "roomId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
