import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateInviteCode } from '@/lib/utils'

// GET /api/rooms - Get all rooms for current user
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const memberships = await prisma.roomMembership.findMany({
    where: { userId: session.user.id },
    include: {
      room: {
        include: {
          _count: {
            select: {
              memberships: true,
              mediaItems: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rooms = memberships.map((m) => ({
    id: m.room.id,
    name: m.room.name,
    inviteCode: m.room.inviteCode,
    role: m.role,
    memberCount: m.room._count.memberships,
    mediaItemCount: m.room._count.mediaItems,
    createdAt: m.room.createdAt,
  }))

  return NextResponse.json({ rooms })
}

// POST /api/rooms - Create a new room
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Room name is required' }, { status: 400 })
  }

  // Generate unique invite code
  let inviteCode = generateInviteCode()
  let exists = await prisma.room.findUnique({ where: { inviteCode } })
  while (exists) {
    inviteCode = generateInviteCode()
    exists = await prisma.room.findUnique({ where: { inviteCode } })
  }

  const room = await prisma.room.create({
    data: {
      name: name.trim(),
      inviteCode,
      memberships: {
        create: {
          userId: session.user.id,
          role: 'owner',
        },
      },
    },
  })

  return NextResponse.json({ room })
}

