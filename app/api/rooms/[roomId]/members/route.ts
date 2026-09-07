import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/rooms/[roomId]/members - Get all members of a room
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { roomId } = params

  // Verify user is a member of the room
  const membership = await prisma.roomMembership.findUnique({
    where: {
      userId_roomId: {
        userId: session.user.id,
        roomId,
      },
    },
  })

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this room' }, {
      status: 403,
    })
  }

  // Get all members of the room
  const memberships = await prisma.roomMembership.findMany({
    where: { roomId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Deduplicate members by userId (in case of duplicate memberships)
  const seenUserIds = new Set<string>()
  const members = memberships
    .map((m) => ({
      id: m.user.id,
      name: m.user.name,
      imageUrl: m.user.imageUrl,
      role: m.role,
    }))
    .filter((member) => {
      if (seenUserIds.has(member.id)) {
        return false
      }
      seenUserIds.add(member.id)
      return true
    })

  return NextResponse.json({
    members,
    currentUserRole: membership.role,
  })
}

// DELETE /api/rooms/[roomId]/members - Remove a member from a room (only for owners)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { roomId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { roomId } = params

  // Get the request body to find which user to remove
  const body = await request.json().catch(() => ({}))
  const { userId } = body

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
  }

  // Verify the current user is an owner of the room
  const membership = await prisma.roomMembership.findUnique({
    where: {
      userId_roomId: {
        userId: session.user.id,
        roomId,
      },
    },
  })

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this room' }, {
      status: 403,
    })
  }

  if (membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only room owners can remove members' }, {
      status: 403,
    })
  }

  // Prevent owners from removing themselves
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: 'Cannot remove yourself from the room' },
      { status: 400 },
    )
  }

  // Check if the user to remove is a member
  const memberToRemove = await prisma.roomMembership.findUnique({
    where: {
      userId_roomId: {
        userId,
        roomId,
      },
    },
  })

  if (!memberToRemove) {
    return NextResponse.json({ error: 'User is not a member of this room' }, {
      status: 404,
    })
  }

  // Only the membership goes. The removed user's UserMediaPreference rows and
  // the titles they added stay: lib/visibility.ts hides their ratings from
  // remaining members because they no longer share a room, while the ratings
  // remain theirs in Just My Stuff and any other rooms they still belong to.
  await prisma.roomMembership.delete({
    where: {
      userId_roomId: {
        userId,
        roomId,
      },
    },
  })

  return NextResponse.json({ success: true })
}
