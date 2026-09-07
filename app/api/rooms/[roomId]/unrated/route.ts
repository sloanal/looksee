import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  filterMediaVisibility,
  itemsInRoomWhere,
  loadMembersByRoomId,
  unionMemberIds,
  visiblePreferenceInclude,
  visibleRoomInclude,
} from '@/lib/visibility'
import { resolveSubmission, resolveVisibleAttribution } from '@/lib/media-attribution'

// GET /api/rooms/[roomId]/unrated - Get unrated media items for current user
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { roomId } = params

  // Verify user is a member of the room
  const membership = await prisma.roomMembership.findUnique({
    where: {
      userId_roomId: {
        userId: session.user.id,
        roomId,
      },
    },
  })

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this room' }, {
      status: 403,
    })
  }

  // Get all media items in the room via MediaItemRoom (not legacy roomId)
  const allMediaItems = await prisma.mediaItem.findMany({
    where: itemsInRoomWhere(roomId),
    select: { id: true },
  })

  const mediaItemIds = allMediaItems.map((m) => m.id)

  // Items the user has actually rated; favorite-only rows (ratedAt null) stay unrated.
  const ratedItems = await prisma.userMediaPreference.findMany({
    where: {
      userId: session.user.id,
      mediaItemId: { in: mediaItemIds },
      ratedAt: { not: null },
    },
    select: { mediaItemId: true },
  })

  const ratedItemIds = new Set(ratedItems.map((r) => r.mediaItemId))
  const unratedItemIds = mediaItemIds.filter((id) => !ratedItemIds.has(id))

  const membersByRoomId = await loadMembersByRoomId([roomId])
  const roomMemberIds = membersByRoomId.get(roomId) ?? new Set<string>()
  const visiblePrefUserIds = unionMemberIds(membersByRoomId, [session.user.id])

  // Get full details of unrated items
  const unratedItems = await prisma.mediaItem.findMany({
    where: {
      id: { in: unratedItemIds },
    },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      mediaItemRooms: {
        where: { roomId },
        include: visibleRoomInclude,
      },
      preferences: {
        where: { userId: { in: visiblePrefUserIds } },
        include: visiblePreferenceInclude,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const items = unratedItems.map((item) => {
    const genres = item.genres ? JSON.parse(item.genres) : []
    const addedBy = resolveVisibleAttribution(
      item,
      session.user.id,
      [roomId],
      roomMemberIds,
    )
    const visibility = filterMediaVisibility(item, {
      viewerUserId: session.user.id,
      viewerRoomIds: [roomId],
      focusedRoomId: roomId,
      membersByRoomId,
    })
    return {
      id: item.id,
      title: item.title,
      type: item.type.toLowerCase(),
      posterUrl: item.posterUrl,
      description: item.description,
      genres,
      runtimeMinutes: item.runtimeMinutes,
      rating: item.rating,
      releaseDate: item.releaseDate,
      createdBy: addedBy?.name ?? 'Unknown',
      createdAt: item.createdAt,
      myPreference: visibility.myPreference,
      otherPreferences: visibility.otherPreferences,
      submission: resolveSubmission(item, session.user.id, [roomId], roomMemberIds),
    }
  })

  return NextResponse.json({ items })
}
