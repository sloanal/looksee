import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateRoomName } from '@/lib/room-name'

// PATCH /api/rooms/[roomId] - Rename a room (only if user is owner)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { roomId } = params

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

  if (membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only room owners can rename rooms' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const validated = validateRoomName((body as { name?: unknown } | null)?.name)
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }
  const name = validated.name

  const room = await prisma.room.update({
    where: { id: roomId },
    data: { name },
    include: {
      _count: {
        select: { memberships: true, mediaItemRooms: true },
      },
    },
  })

  return NextResponse.json({
    room: {
      id: room.id,
      name: room.name,
      inviteCode: room.inviteCode,
      role: membership.role,
      memberCount: room._count.memberships,
      mediaItemCount: room._count.mediaItemRooms,
      createdAt: room.createdAt,
    },
  })
}

// DELETE /api/rooms/[roomId] - Delete a room (only if user is owner)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { roomId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { roomId } = params

  // Check if user is owner of the room
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

  if (membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only room owners can delete rooms' }, { status: 403 })
  }

  // Cascade removes RoomMembership and MediaItemRoom rows only. MediaItem is a
  // global title (legacy MediaItem.roomId is SetNull), so titles and every
  // user's preferences survive for other rooms that hold them.
  await prisma.room.delete({
    where: { id: roomId },
  })

  return NextResponse.json({ success: true })
}
