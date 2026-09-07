import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyRoomAdditions } from '@/lib/push'
import { buildSourceMeta } from '@/lib/media-attribution'

type Db = Prisma.TransactionClient | typeof prisma

/**
 * The caller's personal "want to watch" catalog: titles they created but never
 * rated, plus titles they rated HAVE_NOT_SEEN and have not marked watched.
 * (userId, mediaItemId) is unique on UserMediaPreference, so the `some`
 * clause alone excludes ALREADY_SEEN and watched titles. This is strictly the
 * caller's own data — never titles reachable only through someone else's room.
 */
function wantToWatchWhere(userId: string) {
  return {
    OR: [
      { createdByUserId: userId, preferences: { none: { userId } } },
      { preferences: { some: { userId, status: 'HAVE_NOT_SEEN', isWatched: false } } },
    ],
  }
}

async function loadImportPlan(db: Db, userId: string, roomId: string) {
  const items = await db.mediaItem.findMany({
    where: wantToWatchWhere(userId),
    select: {
      id: true,
      mediaItemRooms: { where: { roomId }, select: { id: true } },
    },
  })
  const missingIds = items
    .filter((item) => item.mediaItemRooms.length === 0)
    .map((item) => item.id)
  return { total: items.length, missingIds }
}

async function authorize(roomId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const membership = await prisma.roomMembership.findUnique({
    where: { userId_roomId: { userId: session.user.id, roomId } },
    select: { id: true },
  })
  if (!membership) {
    return {
      error: NextResponse.json({ error: 'Not a member of this room' }, { status: 403 }),
    }
  }

  return { userId: session.user.id }
}

// GET /api/rooms/[roomId]/import-watchlist - dry run: how many titles a POST would add
export async function GET(
  _request: NextRequest,
  { params }: { params: { roomId: string } },
) {
  const auth = await authorize(params.roomId)
  if ('error' in auth) return auth.error

  const plan = await loadImportPlan(prisma, auth.userId, params.roomId)
  return NextResponse.json({ count: plan.missingIds.length, total: plan.total })
}

// POST /api/rooms/[roomId]/import-watchlist - add the caller's want-to-watch titles to the room
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } },
) {
  if (request.nextUrl.searchParams.get('dryRun') === 'true') {
    return GET(request, { params })
  }

  const auth = await authorize(params.roomId)
  if ('error' in auth) return auth.error

  const { roomId } = params
  const { userId } = auth
  // The body is optional (older clients send none); only timezone/locale are read.
  const sourceMeta = buildSourceMeta(await request.json().catch(() => null))

  try {
    const result = await prisma.$transaction(async (tx) => {
      const plan = await loadImportPlan(tx, userId, roomId)

      const created = plan.missingIds.length === 0
        ? { count: 0 }
        : await tx.mediaItemRoom.createMany({
          data: plan.missingIds.map((mediaItemId) => ({
            mediaItemId,
            roomId,
            addedByUserId: userId,
            sourceMeta,
          })),
          skipDuplicates: true,
        })

      return {
        added: created.count,
        skipped: plan.total - created.count,
        total: plan.total,
        addedIds: plan.missingIds,
      }
    })

    const { addedIds, ...counts } = result
    if (counts.added > 0) {
      void notifyRoomAdditions({ actorUserId: userId, roomId, mediaItemIds: addedIds })
    }

    return NextResponse.json(counts)
  } catch (error: any) {
    console.error('Error importing watchlist:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import watchlist' },
      { status: 500 },
    )
  }
}
