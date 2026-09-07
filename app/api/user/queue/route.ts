import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  filterMediaVisibility,
  getVisibleMemberIds,
  itemsInRoomsWhere,
  loadMembersByRoomId,
  unionMemberIds,
  visiblePreferenceInclude,
} from '@/lib/visibility'
import { resolveSubmission, resolveVisibleAttribution } from '@/lib/media-attribution'

// GET /api/user/queue - Get unrated media items across all rooms
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get all rooms the user is a member of
  const memberships = await prisma.roomMembership.findMany({
    where: { userId: session.user.id },
    select: { roomId: true },
  })

  const roomIds = memberships.map((m) => m.roomId)

  if (roomIds.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const membersByRoomId = await loadMembersByRoomId(roomIds)
  const visiblePrefUserIds = unionMemberIds(membersByRoomId, [session.user.id])

  // Get all media items in user's rooms via MediaItemRoom (not legacy roomId)
  const allMediaItems = await prisma.mediaItem.findMany({
    where: itemsInRoomsWhere(roomIds),
    select: { id: true },
  })

  const mediaItemIds = allMediaItems.map((m) => m.id)

  if (mediaItemIds.length === 0) {
    return NextResponse.json({ items: [] })
  }

  // Items the user has actually rated. A preference row with ratedAt null
  // (e.g. favorite-only) does not count — the title stays in the queue.
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

  if (unratedItemIds.length === 0) {
    return NextResponse.json({ items: [] })
  }

  // Get full details of unrated items
  const unratedItems = await prisma.mediaItem.findMany({
    where: {
      id: { in: unratedItemIds },
    },
    include: {
      createdBy: {
        select: { id: true, name: true, imageUrl: true },
      },
      mediaItemRooms: {
        include: {
          room: { select: { id: true, name: true } },
          addedBy: { select: { id: true, name: true, imageUrl: true } },
        },
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
    const visibility = filterMediaVisibility(item, {
      viewerUserId: session.user.id,
      viewerRoomIds: roomIds,
      membersByRoomId,
    })
    const visibleRoomIds = visibility.rooms.map((room) => room.id)
    const visibleMemberIds = getVisibleMemberIds(visibleRoomIds, membersByRoomId)
    const addedBy = resolveVisibleAttribution(
      item,
      session.user.id,
      visibleRoomIds,
      visibleMemberIds,
    )

    return {
      id: item.id,
      title: item.title,
      type: item.type.toLowerCase(),
      tmdbId: item.tmdbId,
      sourceType: item.sourceType?.toLowerCase(),
      posterUrl: item.posterUrl,
      description: item.description,
      genres,
      runtimeMinutes: item.runtimeMinutes,
      rating: item.rating,
      releaseDate: item.releaseDate,
      createdBy: addedBy?.name ?? 'Unknown',
      createdByUserId: addedBy?.id ?? null,
      createdByImageUrl: addedBy?.imageUrl ?? null,
      roomId: visibility.rooms[0]?.id ?? '',
      roomName: visibility.rooms[0]?.name ?? '',
      createdAt: item.createdAt,
      rooms: visibility.rooms,
      myPreference: visibility.myPreference,
      otherPreferences: visibility.otherPreferences,
      submission: resolveSubmission(item, session.user.id, visibleRoomIds, visibleMemberIds),
    }
  })

  return NextResponse.json({ items })
}
