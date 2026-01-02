import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/media/[mediaItemId]/preference - Create or update user preference
export async function POST(
  request: NextRequest,
  { params }: { params: { mediaItemId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { mediaItemId } = params
  const body = await request.json()

  const { status, excitement, notes, recommendedByName, recommendationContext } = body

  if (!status || !excitement) {
    return NextResponse.json({ error: 'Status and excitement are required' }, { status: 400 })
  }

  if (excitement < 1 || excitement > 5) {
    return NextResponse.json({ error: 'Excitement must be between 1 and 5' }, { status: 400 })
  }

  // Verify media item exists and user has access (is member of the room)
  const mediaItem = await prisma.mediaItem.findUnique({
    where: { id: mediaItemId },
    include: {
      room: {
        include: {
          memberships: {
            where: { userId: session.user.id },
          },
        },
      },
    },
  })

  if (!mediaItem) {
    return NextResponse.json({ error: 'Media item not found' }, { status: 404 })
  }

  if (mediaItem.room.memberships.length === 0) {
    return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 })
  }

  const preference = await prisma.userMediaPreference.upsert({
    where: {
      userId_mediaItemId: {
        userId: session.user.id,
        mediaItemId,
      },
    },
    create: {
      userId: session.user.id,
      mediaItemId,
      status: status.toUpperCase(),
      excitement: parseInt(excitement),
      notes: notes || null,
      recommendedByName: recommendedByName || null,
      recommendationContext: recommendationContext || null,
    },
    update: {
      status: status.toUpperCase(),
      excitement: parseInt(excitement),
      notes: notes || null,
      recommendedByName: recommendedByName || null,
      recommendationContext: recommendationContext || null,
      updatedAt: new Date(),
    },
  })

  return NextResponse.json({ preference })
}

// PATCH /api/media/[mediaItemId]/preference - Update preference fields (notes, recommendedByName, recommendationContext) without requiring status/excitement
export async function PATCH(
  request: NextRequest,
  { params }: { params: { mediaItemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { mediaItemId } = params
    const body = await request.json()

    const { notes, recommendedByName, recommendationContext } = body

    // Verify media item exists and user has access (is member of the room)
    const mediaItem = await prisma.mediaItem.findUnique({
      where: { id: mediaItemId },
      include: {
        room: {
          include: {
            memberships: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    })

    if (!mediaItem) {
      return NextResponse.json({ error: 'Media item not found' }, { status: 404 })
    }

    if (mediaItem.room.memberships.length === 0) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 })
    }

    // Get existing preference or create a default one
    const existingPreference = await prisma.userMediaPreference.findUnique({
      where: {
        userId_mediaItemId: {
          userId: session.user.id,
          mediaItemId,
        },
      },
    })

    const updateData: any = {}
    if (notes !== undefined) updateData.notes = notes || null
    if (recommendedByName !== undefined) updateData.recommendedByName = recommendedByName || null
    if (recommendationContext !== undefined) updateData.recommendationContext = recommendationContext || null
    updateData.updatedAt = new Date()

    const preference = existingPreference
      ? await prisma.userMediaPreference.update({
          where: {
            userId_mediaItemId: {
              userId: session.user.id,
              mediaItemId,
            },
          },
          data: updateData,
        })
      : await prisma.userMediaPreference.create({
          data: {
            userId: session.user.id,
            mediaItemId,
            status: 'NOT_SEEN_WANT',
            excitement: 3,
            ...updateData,
          },
        })

    return NextResponse.json({ preference })
  } catch (error: any) {
    console.error('Error updating preference:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update preference' },
      { status: 500 }
    )
  }
}

