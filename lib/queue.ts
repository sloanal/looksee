import { prisma } from '@/lib/prisma'
import { itemsInRoomsWhere } from '@/lib/visibility'

export type QueueScope = {
  /** Rooms the viewer currently belongs to. */
  roomIds: string[]
  /** Items in those rooms the viewer has not rated yet. */
  unratedItemIds: string[]
}

/**
 * The New queue: titles in the viewer's rooms with no rating from them yet.
 *
 * A preference row with `ratedAt` null (favorite-only, for example) does not
 * count as rated, so the title stays in the queue. Shared by the queue listing
 * and the bulk accept endpoint so both agree on what "in the queue" means.
 */
export async function loadQueueScope(userId: string): Promise<QueueScope> {
  const memberships = await prisma.roomMembership.findMany({
    where: { userId },
    select: { roomId: true },
  })

  const roomIds = memberships.map((membership) => membership.roomId)
  if (roomIds.length === 0) {
    return { roomIds, unratedItemIds: [] }
  }

  const itemsInRooms = await prisma.mediaItem.findMany({
    where: itemsInRoomsWhere(roomIds),
    select: { id: true },
  })

  const mediaItemIds = itemsInRooms.map((item) => item.id)
  if (mediaItemIds.length === 0) {
    return { roomIds, unratedItemIds: [] }
  }

  const rated = await prisma.userMediaPreference.findMany({
    where: {
      userId,
      mediaItemId: { in: mediaItemIds },
      ratedAt: { not: null },
    },
    select: { mediaItemId: true },
  })

  const ratedItemIds = new Set(rated.map((preference) => preference.mediaItemId))

  return {
    roomIds,
    unratedItemIds: mediaItemIds.filter((id) => !ratedItemIds.has(id)),
  }
}
