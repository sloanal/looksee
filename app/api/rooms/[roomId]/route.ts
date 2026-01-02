import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE /api/rooms/[roomId] - Delete a room (only if user is owner)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { roomId: string } }
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

  // Delete the room (cascade will handle memberships and media items)
  await prisma.room.delete({
    where: { id: roomId },
  })

  return NextResponse.json({ success: true })
}

