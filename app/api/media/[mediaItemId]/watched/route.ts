import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { userCanAccessMediaItem } from '@/lib/visibility'

// POST /api/media/[mediaItemId]/watched - mark as watched for current user
export async function POST(
  _request: Request,
  { params }: { params: { mediaItemId: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const mediaItem = await prisma.mediaItem.findUnique({
      where: { id: params.mediaItemId },
      select: { id: true },
    })

    if (!mediaItem) {
      return NextResponse.json({ error: 'Media item not found' }, { status: 404 })
    }

    if (!(await userCanAccessMediaItem(session.user.id, params.mediaItemId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existingPreference = await prisma.userMediaPreference.findUnique({
      where: {
        userId_mediaItemId: {
          userId: session.user.id,
          mediaItemId: params.mediaItemId,
        },
      },
    })

    const now = new Date()
    await prisma.userMediaPreference.upsert({
      where: {
        userId_mediaItemId: {
          userId: session.user.id,
          mediaItemId: params.mediaItemId,
        },
      },
      create: {
        userId: session.user.id,
        mediaItemId: params.mediaItemId,
        status: 'ALREADY_SEEN',
        isWatched: true,
        excitement: existingPreference?.excitement || 3,
        notes: existingPreference?.notes || null,
        recommendedByName: existingPreference?.recommendedByName || null,
        recommendationContext: existingPreference?.recommendationContext || null,
        ratedAt: now,
      },
      update: {
        status: 'ALREADY_SEEN',
        isWatched: true,
        updatedAt: now,
        ratedAt: now,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error marking item as watched:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to mark item as watched' },
      { status: 500 },
    )
  }
}

// DELETE /api/media/[mediaItemId]/watched - un-mark watched for current user.
// POST flips status to ALREADY_SEEN alongside isWatched, so DELETE reverses
// both: the title goes back to HAVE_NOT_SEEN (the user is interested again and
// loses the seen marker). We can't tell a watched-route ALREADY_SEEN from one
// set via the rating flow, so a user who only meant "seen, not watched here"
// re-rates the title. Like POST, this is an explicit rating action (ratedAt).
export async function DELETE(
  _request: Request,
  { params }: { params: { mediaItemId: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existingPreference = await prisma.userMediaPreference.findUnique({
      where: {
        userId_mediaItemId: {
          userId: session.user.id,
          mediaItemId: params.mediaItemId,
        },
      },
    })

    if (!existingPreference) {
      return NextResponse.json({ error: 'Preference not found' }, { status: 404 })
    }

    const now = new Date()
    await prisma.userMediaPreference.update({
      where: {
        userId_mediaItemId: {
          userId: session.user.id,
          mediaItemId: params.mediaItemId,
        },
      },
      data: {
        status: 'HAVE_NOT_SEEN',
        isWatched: false,
        updatedAt: now,
        ratedAt: now,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error removing item from watched:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove item from watched' },
      { status: 500 },
    )
  }
}
