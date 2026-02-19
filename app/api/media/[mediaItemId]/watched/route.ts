import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/media/[mediaItemId]/watched - mark as watched and remove from all rooms
export async function POST(
  _request: Request,
  { params }: { params: { mediaItemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const mediaItem = await prisma.mediaItem.findUnique({
      where: { id: params.mediaItemId },
      include: {
        mediaItemRooms: {
          select: { roomId: true },
        },
      },
    })

    if (!mediaItem) {
      return NextResponse.json({ error: 'Media item not found' }, { status: 404 })
    }

    const roomIds = mediaItem.mediaItemRooms.map((mir) => mir.roomId)
    if (roomIds.length > 0) {
      const membershipCount = await prisma.roomMembership.count({
        where: {
          userId: session.user.id,
          roomId: { in: roomIds },
        },
      })

      if (membershipCount === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.mediaItemRoom.deleteMany({
        where: { mediaItemId: params.mediaItemId },
      })

      const existingPreference = await tx.userMediaPreference.findUnique({
        where: {
          userId_mediaItemId: {
            userId: session.user.id,
            mediaItemId: params.mediaItemId,
          },
        },
      })

      await tx.userMediaPreference.upsert({
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
          excitement: existingPreference?.excitement || 3,
          notes: existingPreference?.notes || null,
          recommendedByName: existingPreference?.recommendedByName || null,
          recommendationContext: existingPreference?.recommendationContext || null,
        },
        update: {
          status: 'ALREADY_SEEN',
          updatedAt: new Date(),
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error marking item as watched:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to mark item as watched' },
      { status: 500 }
    )
  }
}

// DELETE /api/media/[mediaItemId]/watched - remove from watched list
export async function DELETE(
  _request: Request,
  { params }: { params: { mediaItemId: string } }
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

    await prisma.userMediaPreference.update({
      where: {
        userId_mediaItemId: {
          userId: session.user.id,
          mediaItemId: params.mediaItemId,
        },
      },
      data: {
        status: 'HAVE_NOT_SEEN',
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error removing item from watched:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove item from watched' },
      { status: 500 }
    )
  }
}
