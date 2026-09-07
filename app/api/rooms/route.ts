import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateInviteCode } from '@/lib/utils'
import { validateRoomName } from '@/lib/room-name'
import { itemsInRoomsWhere, personalCatalogClauses } from '@/lib/visibility'

// GET /api/rooms - Get all rooms for current user
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  const memberships = await prisma.roomMembership.findMany({
    where: { userId },
    include: {
      room: {
        include: {
          _count: {
            select: { memberships: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const roomIds = memberships.map((m) => m.roomId)
  const watchedByMe = { preferences: { some: { userId, isWatched: true } } }

  // Room membership of a title is the MediaItemRoom join table; the legacy
  // MediaItem.roomId column is only the "original room" and must not be counted.
  const [joinCounts, unwatchedJoinCounts, allRoomsCount, watchedCount] = await Promise.all([
    prisma.mediaItemRoom.groupBy({
      by: ['roomId'],
      where: { roomId: { in: roomIds } },
      _count: { _all: true },
    }),
    prisma.mediaItemRoom.groupBy({
      by: ['roomId'],
      where: { roomId: { in: roomIds }, mediaItem: { NOT: watchedByMe } },
      _count: { _all: true },
    }),
    // Mirrors GET /api/media?allRooms=true (what Browse "All Rooms" lists):
    // titles in any of my rooms plus my personal catalog, minus anything I've
    // marked watched. Keep in lockstep with that route.
    prisma.mediaItem.count({
      where: {
        OR: [
          ...(roomIds.length > 0 ? [itemsInRoomsWhere(roomIds)] : []),
          ...personalCatalogClauses(userId),
        ],
        NOT: watchedByMe,
      },
    }),
    // Mirrors GET /api/media?watched=true; (userId, mediaItemId) is unique so
    // counting preferences equals counting titles.
    prisma.userMediaPreference.count({ where: { userId, isWatched: true } }),
  ])

  const countByRoom = (groups: { roomId: string; _count: { _all: number } }[]) =>
    new Map(groups.map((g) => [g.roomId, g._count._all]))
  const mediaItemCountByRoom = countByRoom(joinCounts)
  const unwatchedCountByRoom = countByRoom(unwatchedJoinCounts)

  const rooms = memberships.map((m) => ({
    id: m.room.id,
    name: m.room.name,
    inviteCode: m.room.inviteCode,
    role: m.role,
    memberCount: m.room._count.memberships,
    mediaItemCount: mediaItemCountByRoom.get(m.roomId) ?? 0,
    unwatchedCount: unwatchedCountByRoom.get(m.roomId) ?? 0,
    createdAt: m.room.createdAt,
  }))

  return NextResponse.json({ rooms, allRoomsCount, watchedCount })
}

// POST /api/rooms - Create a new room
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  // Generate unique invite code
  let inviteCode = generateInviteCode()
  let exists = await prisma.room.findUnique({ where: { inviteCode } })
  while (exists) {
    inviteCode = generateInviteCode()
    exists = await prisma.room.findUnique({ where: { inviteCode } })
  }

  const room = await prisma.room.create({
    data: {
      name,
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
