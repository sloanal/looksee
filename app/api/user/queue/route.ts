import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

  // Get all media items in user's rooms
  const allMediaItems = await prisma.mediaItem.findMany({
    where: { roomId: { in: roomIds } },
    select: { id: true },
  })

  const mediaItemIds = allMediaItems.map((m) => m.id)

  if (mediaItemIds.length === 0) {
    return NextResponse.json({ items: [] })
  }

  // Get items the user has already rated
  const ratedItems = await prisma.userMediaPreference.findMany({
    where: {
      userId: session.user.id,
      mediaItemId: { in: mediaItemIds },
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
      room: {
        select: { id: true, name: true },
      },
      mediaItemRooms: {
        include: {
          room: {
            select: { id: true, name: true },
          },
          addedBy: {
            select: { id: true, name: true },
          },
        },
      },
      preferences: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const items = unratedItems.map((item) => {
    const genres = item.genres ? JSON.parse(item.genres) : []
    
    // Get other users' preferences (exclude current user since these are unrated items)
    const otherPreferences = item.preferences
      .filter((p) => p.userId !== session.user.id)
      .map((p) => ({
        status: p.status.toLowerCase(),
        excitement: p.excitement,
        user: {
          id: p.user.id,
          name: p.user.name,
          imageUrl: p.user.imageUrl,
        },
      }))

    const visibleRooms = item.mediaItemRooms
      .filter((mir) => roomIds.includes(mir.roomId))
      .map((mir) => ({
        id: mir.room.id,
        name: mir.room.name,
        addedByUserId: mir.addedByUserId,
        addedByName: mir.addedBy.name,
      }))

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
      createdBy: item.createdBy.name,
      createdByUserId: item.createdBy.id,
      createdByImageUrl: item.createdBy.imageUrl,
      roomId: item.room.id,
      roomName: item.room.name,
      createdAt: item.createdAt,
      rooms: visibleRooms,
      otherPreferences,
    }
  })

  return NextResponse.json({ items })
}

