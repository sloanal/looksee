import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/media/[mediaItemId] - Update a media item
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

    // Only allow updating if item was added manually
    if (mediaItem.sourceType !== 'MANUAL') {
      return NextResponse.json(
        { error: 'Only manually added items can be edited' },
        { status: 403 }
      )
    }

    const {
      title,
      type,
      externalUrl,
      posterUrl,
      description,
      genres,
      runtimeMinutes,
    } = body

    const updateData: any = {}
    if (title !== undefined) updateData.title = title.trim()
    if (type !== undefined) updateData.type = type.toUpperCase()
    if (externalUrl !== undefined) updateData.externalUrl = externalUrl || null
    if (posterUrl !== undefined) updateData.posterUrl = posterUrl || null
    if (description !== undefined) updateData.description = description || null
    if (genres !== undefined) updateData.genres = genres ? JSON.stringify(genres) : '[]'
    if (runtimeMinutes !== undefined) updateData.runtimeMinutes = runtimeMinutes || null

    const updatedItem = await prisma.mediaItem.update({
      where: { id: mediaItemId },
      data: updateData,
    })

    return NextResponse.json({ mediaItem: updatedItem })
  } catch (error: any) {
    console.error('Error updating media item:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update media item' },
      { status: 500 }
    )
  }
}

// DELETE /api/media/[mediaItemId] - Delete a media item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { mediaItemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { mediaItemId } = params

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

    // Only allow deletion if user created the item
    if (mediaItem.createdByUserId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only delete items you created' },
        { status: 403 }
      )
    }

    // Delete the media item (cascade will handle preferences)
    await prisma.mediaItem.delete({
      where: { id: mediaItemId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting media item:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete media item' },
      { status: 500 }
    )
  }
}

