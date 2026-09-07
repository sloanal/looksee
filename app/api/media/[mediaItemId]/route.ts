import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { userCanAccessMediaItem, userMayRemoveFromRoom } from '@/lib/visibility'
import { serializePublicMediaItem } from '@/lib/media-attribution'

// PATCH /api/media/[mediaItemId] - Update a media item
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

    const mediaItem = await prisma.mediaItem.findUnique({
      where: { id: mediaItemId },
      select: { id: true, sourceType: true },
    })

    if (!mediaItem) {
      return NextResponse.json({ error: 'Media item not found' }, {
        status: 404,
      })
    }

    if (!(await userCanAccessMediaItem(session.user.id, mediaItemId))) {
      return NextResponse.json({ error: 'Not a member of this room' }, {
        status: 403,
      })
    }

    // Only allow updating if item was added manually
    if (mediaItem.sourceType !== 'MANUAL') {
      return NextResponse.json(
        { error: 'Only manually added items can be edited' },
        { status: 403 },
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
    if (genres !== undefined) {
      updateData.genres = genres ? JSON.stringify(genres) : '[]'
    }
    if (runtimeMinutes !== undefined) {
      updateData.runtimeMinutes = runtimeMinutes || null
    }

    const updatedItem = await prisma.mediaItem.update({
      where: { id: mediaItemId },
      data: updateData,
    })

    return NextResponse.json({ mediaItem: serializePublicMediaItem(updatedItem) })
  } catch (error: any) {
    console.error('Error updating media item:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update media item' },
      { status: 500 },
    )
  }
}

// DELETE /api/media/[mediaItemId] - Delete a media item
//
// A MediaItem is one global title shared across households, so a hard delete
// would remove it from every room. The rule (room-removal half is
// userMayRemoveFromRoom, shared with PATCH /api/media/[id]/rooms):
//   - Creator, and every room the title is in is one the deleter belongs to
//     (including "in no rooms", i.e. Just My Stuff) -> hard delete; cascades
//     remove MediaItemRoom joins and all preferences (AND-413).
//   - Otherwise detach: remove the MediaItemRoom joins for the rooms the caller
//     may remove it from (creator: any room they belong to; member: rooms where
//     they added it or which they own). The caller's own preference is removed
//     only when the title is then in none of their rooms — i.e. it leaves their
//     catalog rather than being silently unrated while still visible.
//   - Title in none of the caller's rooms but rated by them (personal catalog)
//     -> remove only their preference.
//   - Nothing removable -> 403. Other households and their ratings are never
//     touched.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { mediaItemId: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { mediaItemId } = params
    const userId = session.user.id

    const mediaItem = await prisma.mediaItem.findUnique({
      where: { id: mediaItemId },
      select: {
        id: true,
        createdByUserId: true,
        mediaItemRooms: { select: { roomId: true, addedByUserId: true } },
        preferences: { where: { userId }, select: { id: true }, take: 1 },
      },
    })

    if (!mediaItem) {
      return NextResponse.json({ error: 'Media item not found' }, {
        status: 404,
      })
    }

    const memberships = await prisma.roomMembership.findMany({
      where: { userId },
      select: { roomId: true, role: true },
    })
    const userRoomIds = new Set(memberships.map((m) => m.roomId))
    const ownedRoomIds = new Set(
      memberships.filter((m) => m.role === 'owner').map((m) => m.roomId),
    )

    const isCreator = mediaItem.createdByUserId === userId
    const itemRoomIds = mediaItem.mediaItemRooms.map((mir) => mir.roomId)
    const sharedJoins = mediaItem.mediaItemRooms.filter((mir) => userRoomIds.has(mir.roomId))
    const removableRoomIds = sharedJoins
      .filter((mir) =>
        userMayRemoveFromRoom({
          userId,
          isCreator,
          addedByUserId: mir.addedByUserId,
          ownedRoomIds,
          roomId: mir.roomId,
        })
      )
      .map((mir) => mir.roomId)
    const hasOwnPreference = mediaItem.preferences.length > 0

    if (isCreator && sharedJoins.length === itemRoomIds.length) {
      await prisma.mediaItem.delete({ where: { id: mediaItemId } })
      return NextResponse.json({ success: true, deleted: true })
    }

    if (removableRoomIds.length === 0) {
      if (sharedJoins.length === 0 && hasOwnPreference) {
        await prisma.userMediaPreference.deleteMany({ where: { mediaItemId, userId } })
        return NextResponse.json({ success: true, deleted: false, removedFromRoomIds: [] })
      }
      return NextResponse.json(
        {
          error: sharedJoins.length === 0
            ? 'Not a member of this room'
            : 'You can only remove titles you added to a room or from rooms you own',
        },
        { status: 403 },
      )
    }

    const leavesCatalog = removableRoomIds.length === sharedJoins.length
    await prisma.$transaction([
      prisma.mediaItemRoom.deleteMany({
        where: { mediaItemId, roomId: { in: removableRoomIds } },
      }),
      ...(leavesCatalog
        ? [prisma.userMediaPreference.deleteMany({ where: { mediaItemId, userId } })]
        : []),
    ])

    return NextResponse.json({
      success: true,
      deleted: false,
      removedFromRoomIds: removableRoomIds,
    })
  } catch (error: any) {
    console.error('Error deleting media item:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete media item' },
      { status: 500 },
    )
  }
}
