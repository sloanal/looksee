import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/rooms/join - Join a room by invite code
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { inviteCode } = body

  if (!inviteCode || typeof inviteCode !== 'string') {
    return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })
  }

  const room = await prisma.room.findUnique({
    where: { inviteCode: inviteCode.toUpperCase() },
    include: {
      _count: {
        select: {
          mediaItems: true,
        },
      },
    },
  })

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  // Check if user is already a member
  const existingMembership = await prisma.roomMembership.findUnique({
    where: {
      userId_roomId: {
        userId: session.user.id,
        roomId: room.id,
      },
    },
  })

  if (existingMembership) {
    return NextResponse.json({ 
      room: {
        id: room.id,
        name: room.name,
        inviteCode: room.inviteCode,
      },
      alreadyMember: true,
      mediaItemCount: room._count.mediaItems,
    })
  }

  // Create membership
  await prisma.roomMembership.create({
    data: {
      userId: session.user.id,
      roomId: room.id,
      role: 'member',
    },
  })

  return NextResponse.json({ 
    room: {
      id: room.id,
      name: room.name,
      inviteCode: room.inviteCode,
    },
    mediaItemCount: room._count.mediaItems,
  })
}

