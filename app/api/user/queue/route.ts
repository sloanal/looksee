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
        select: { name: true },
      },
      room: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const items = unratedItems.map((item) => {
    const genres = item.genres ? JSON.parse(item.genres) : []
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
      createdBy: item.createdBy.name,
      roomId: item.room.id,
      roomName: item.room.name,
      createdAt: item.createdAt,
    }
  })

  return NextResponse.json({ items })
}

