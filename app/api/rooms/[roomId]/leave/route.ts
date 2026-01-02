import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/rooms/[roomId]/leave - Leave a room (only if user is not owner)
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { roomId } = params

  // Check if user is a member of the room
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

  // Prevent owners from leaving (they should delete the room instead)
  if (membership.role === 'owner') {
    return NextResponse.json(
      { error: 'Room owners cannot leave. Please delete the room instead.' },
      { status: 403 }
    )
  }

  // Delete the membership
  await prisma.roomMembership.delete({
    where: {
      userId_roomId: {
        userId: session.user.id,
        roomId,
      },
    },
  })

  return NextResponse.json({ success: true })
}

