import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  serializeVisibleRooms,
  userCanAccessMediaItem,
  userMayRemoveFromRoom,
  visibleRoomInclude,
} from '@/lib/visibility'
import { buildSourceMeta, serializePublicMediaItem } from '@/lib/media-attribution'
import { notifyRoomAdditions } from '@/lib/push'

// GET /api/media/[mediaItemId]/rooms - Rooms the viewer can see for this title
export async function GET(
  _request: NextRequest,
  { params }: { params: { mediaItemId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await userCanAccessMediaItem(session.user.id, params.mediaItemId))) {
    return NextResponse.json({ error: 'Media item not found' }, { status: 404 })
  }

  const memberships = await prisma.roomMembership.findMany({
    where: { userId: session.user.id },
    select: { roomId: true },
  })
  const viewerRoomIds = memberships.map((m) => m.roomId)

  const mediaItem = await prisma.mediaItem.findUnique({
    where: { id: params.mediaItemId },
    include: {
      mediaItemRooms: {
        include: visibleRoomInclude,
      },
    },
  })

  if (!mediaItem) {
    return NextResponse.json({ error: 'Media item not found' }, {
      status: 404,
    })
  }

  return NextResponse.json({
    rooms: serializeVisibleRooms(mediaItem.mediaItemRooms, { viewerRoomIds }),
  })
}

// PATCH /api/media/[mediaItemId]/rooms - Update which rooms a media item belongs to
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
    const { roomIds } = body // Array of room IDs the item should belong to

    if (!Array.isArray(roomIds)) {
      return NextResponse.json({ error: 'roomIds must be an array' }, {
        status: 400,
      })
    }

    // Verify the media item exists
    const mediaItem = await prisma.mediaItem.findUnique({
      where: { id: mediaItemId },
      include: {
        mediaItemRooms: true,
      },
    })

    if (!mediaItem) {
      return NextResponse.json({ error: 'Media item not found' }, {
        status: 404,
      })
    }

    // Get all rooms the user is a member of
    const memberships = await prisma.roomMembership.findMany({
      where: { userId: session.user.id },
      select: { roomId: true, role: true },
    })

    const userRoomIds = memberships.map((m) => m.roomId)
    const ownedRoomIds = new Set(
      memberships.filter((m) => m.role === 'owner').map((m) => m.roomId),
    )

    // Verify all requested roomIds are rooms the user is a member of
    const invalidRoomIds = roomIds.filter((rid: string) => !userRoomIds.includes(rid))
    if (invalidRoomIds.length > 0) {
      return NextResponse.json(
        { error: `Not a member of room(s): ${invalidRoomIds.join(', ')}` },
        { status: 403 },
      )
    }

    // Only add/remove rooms the viewer belongs to. Never strip other households.
    const currentRoomIds = mediaItem.mediaItemRooms.map((mir) => mir.roomId)
    const currentVisibleRoomIds = currentRoomIds.filter((rid) => userRoomIds.includes(rid))

    const roomsToAdd = roomIds.filter((rid: string) => !currentRoomIds.includes(rid))
    const roomsToRemove = currentVisibleRoomIds.filter((rid: string) => !roomIds.includes(rid))

    // Attaching a title to a room requires access to the title itself; otherwise
    // anyone holding a title id (e.g. a kicked member) could re-attach it to
    // their own room and regain access.
    if (
      roomsToAdd.length > 0 &&
      !(await userCanAccessMediaItem(session.user.id, mediaItemId))
    ) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 })
    }

    const isCreator = mediaItem.createdByUserId === session.user.id
    for (const roomId of roomsToRemove) {
      const mediaItemRoom = mediaItem.mediaItemRooms.find((mir) => mir.roomId === roomId)
      if (
        mediaItemRoom &&
        !userMayRemoveFromRoom({
          userId: session.user.id,
          isCreator,
          addedByUserId: mediaItemRoom.addedByUserId,
          ownedRoomIds,
          roomId,
        })
      ) {
        return NextResponse.json(
          {
            error: 'You can only remove titles you added to a room or from rooms you own',
          },
          { status: 403 },
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
      const sourceMeta = buildSourceMeta(body)
      await prisma.mediaItemRoom.createMany({
        data: roomsToAdd.map((roomId: string) => ({
          mediaItemId,
          roomId,
          addedByUserId: session.user.id,
          sourceMeta,
        })),
      })
      roomsToAdd.forEach((roomId: string) => {
        void notifyRoomAdditions({
          actorUserId: session.user.id,
          roomId,
          mediaItemIds: [mediaItemId],
        })
      })
    }

    const updatedMediaItem = await prisma.mediaItem.findUnique({
      where: { id: mediaItemId },
      include: {
        mediaItemRooms: {
          include: visibleRoomInclude,
        },
      },
    })

    const rooms = serializeVisibleRooms(
      updatedMediaItem?.mediaItemRooms ?? [],
      {
        viewerRoomIds: userRoomIds,
      },
    )

    return NextResponse.json({
      mediaItem: updatedMediaItem ? serializePublicMediaItem(updatedMediaItem) : null,
      rooms,
    })
  } catch (error: any) {
    console.error('Error updating media item rooms:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update media item rooms' },
      { status: 500 },
    )
  }
}
