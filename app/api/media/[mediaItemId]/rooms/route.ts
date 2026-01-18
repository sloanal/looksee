import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/media/[mediaItemId]/rooms - Update which rooms a media item belongs to
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
    const { roomIds } = body // Array of room IDs the item should belong to

    if (!Array.isArray(roomIds)) {
      return NextResponse.json({ error: 'roomIds must be an array' }, { status: 400 })
    }

    // Verify the media item exists
    const mediaItem = await prisma.mediaItem.findUnique({
      where: { id: mediaItemId },
      include: {
        mediaItemRooms: true,
      },
    })

    if (!mediaItem) {
      return NextResponse.json({ error: 'Media item not found' }, { status: 404 })
    }

    // Get all rooms the user is a member of
    const memberships = await prisma.roomMembership.findMany({
      where: { userId: session.user.id },
      select: { roomId: true },
    })

    const userRoomIds = memberships.map((m) => m.roomId)

    // Verify all requested roomIds are rooms the user is a member of
    const invalidRoomIds = roomIds.filter((rid: string) => !userRoomIds.includes(rid))
    if (invalidRoomIds.length > 0) {
      return NextResponse.json(
        { error: `Not a member of room(s): ${invalidRoomIds.join(', ')}` },
        { status: 403 }
      )
    }

    // Get current room memberships
    const currentRoomIds = mediaItem.mediaItemRooms.map((mir) => mir.roomId)

    // Find rooms to add and remove
    const roomsToAdd = roomIds.filter((rid: string) => !currentRoomIds.includes(rid))
    const roomsToRemove = currentRoomIds.filter((rid: string) => !roomIds.includes(rid))

    // For rooms to remove, check if user was the one who added it
    for (const roomId of roomsToRemove) {
      const mediaItemRoom = mediaItem.mediaItemRooms.find((mir) => mir.roomId === roomId)
      if (mediaItemRoom && mediaItemRoom.addedByUserId !== session.user.id) {
        return NextResponse.json(
          {
            error: `Cannot remove item from room "${mediaItemRoom.roomId}" - you did not add it to this room`,
          },
          { status: 403 }
        )
      }
    }

    // Remove rooms
    if (roomsToRemove.length > 0) {
      await prisma.mediaItemRoom.deleteMany({
        where: {
          mediaItemId,
          roomId: { in: roomsToRemove },
        },
      })
    }

    // Add rooms
    if (roomsToAdd.length > 0) {
      await prisma.mediaItemRoom.createMany({
        data: roomsToAdd.map((roomId: string) => ({
          mediaItemId,
          roomId,
          addedByUserId: session.user.id,
        })),
      })
    }

    // Return updated media item with rooms
    const updatedMediaItem = await prisma.mediaItem.findUnique({
      where: { id: mediaItemId },
      include: {
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
      },
    })

    return NextResponse.json({
      mediaItem: updatedMediaItem,
      rooms: updatedMediaItem?.mediaItemRooms.map((mir) => ({
        id: mir.room.id,
        name: mir.room.name,
        addedByUserId: mir.addedByUserId,
        addedByName: mir.addedBy.name,
      })),
    })
  } catch (error: any) {
    console.error('Error updating media item rooms:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update media item rooms' },
      { status: 500 }
    )
  }
}
