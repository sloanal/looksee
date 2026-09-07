import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { userCanAccessMediaItem } from '@/lib/visibility'

// POST /api/media/[mediaItemId]/preference - Create or update user preference
export async function POST(
  request: NextRequest,
  { params }: { params: { mediaItemId: string } },
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

  const validExcitementValues = [1, 3, 5]
  if (!validExcitementValues.includes(parseInt(excitement))) {
    return NextResponse.json({
      error: 'Excitement must be 1 (Not excited), 3 (Neutral), or 5 (Excited)',
    }, { status: 400 })
  }

  const validStatusValues = ['HAVE_NOT_SEEN', 'ALREADY_SEEN']
  const statusUpper = status.toUpperCase()
  if (!validStatusValues.includes(statusUpper)) {
    return NextResponse.json({ error: 'Status must be "have_not_seen" or "already_seen"' }, {
      status: 400,
    })
  }

  const mediaItem = await prisma.mediaItem.findUnique({
    where: { id: mediaItemId },
    select: { id: true },
  })

  if (!mediaItem) {
    return NextResponse.json({ error: 'Media item not found' }, { status: 404 })
  }

  if (!(await userCanAccessMediaItem(session.user.id, mediaItemId))) {
    return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 })
  }

  const now = new Date()
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
      isWatched: false,
      excitement: parseInt(excitement),
      notes: notes || null,
      recommendedByName: recommendedByName || null,
      recommendationContext: recommendationContext || null,
      ratedAt: now,
    },
    update: {
      status: status.toUpperCase(),
      // If a user marks an item as "have not seen", clear explicit watched marker.
      ...(statusUpper === 'HAVE_NOT_SEEN' ? { isWatched: false } : {}),
      excitement: parseInt(excitement),
      notes: notes || null,
      recommendedByName: recommendedByName || null,
      recommendationContext: recommendationContext || null,
      updatedAt: now,
      ratedAt: now,
    },
  })

  return NextResponse.json({ preference })
}

// PATCH /api/media/[mediaItemId]/preference - Update preference fields (notes, recommendedByName, recommendationContext) without requiring status/excitement
export async function PATCH(
  request: NextRequest,
  { params }: { params: { mediaItemId: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { mediaItemId } = params
    const body = await request.json()

    const { notes, recommendedByName, recommendationContext } = body

    const mediaItem = await prisma.mediaItem.findUnique({
      where: { id: mediaItemId },
      select: { id: true },
    })

    if (!mediaItem) {
      return NextResponse.json({ error: 'Media item not found' }, { status: 404 })
    }

    if (!(await userCanAccessMediaItem(session.user.id, mediaItemId))) {
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
    if (recommendationContext !== undefined) {
      updateData.recommendationContext = recommendationContext || null
    }
    const now = new Date()
    updateData.updatedAt = now
    updateData.ratedAt = now

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
          status: 'HAVE_NOT_SEEN',
          isWatched: false,
          excitement: 3,
          ...updateData,
        },
      })

    return NextResponse.json({ preference })
  } catch (error: any) {
    console.error('Error updating preference:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update preference' },
      { status: 500 },
    )
  }
}
