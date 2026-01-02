import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/rooms/[roomId]/unrated - Get unrated media items for current user
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
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
    return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 })
  }

  // Get all media items in the room
  const allMediaItems = await prisma.mediaItem.findMany({
    where: { roomId },
    select: { id: true },
  })

  const mediaItemIds = allMediaItems.map((m) => m.id)

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

  // Get full details of unrated items
  const unratedItems = await prisma.mediaItem.findMany({
    where: {
      id: { in: unratedItemIds },
    },
    include: {
      createdBy: {
        select: { name: true },
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
      createdAt: item.createdAt,
    }
  })

  return NextResponse.json({ items })
}

