import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { loadQueueScope } from '@/lib/queue'

const VALID_EXCITEMENT = [1, 3, 5]
const VALID_STATUS = ['HAVE_NOT_SEEN', 'ALREADY_SEEN']

/**
 * POST /api/user/queue/accept-all - Rate every title still in the viewer's New
 * queue with one default status/excitement, so a long backlog can be cleared in
 * a single request instead of one per title. Defaults to "have not seen" and
 * neutral excitement; both can be overridden in the body.
 *
 * Existing placeholder rows (favorite-only, `ratedAt` null) are updated in
 * place, so a favorited title keeps its heart while leaving the queue.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const status = String(body?.status ?? 'have_not_seen').toUpperCase()
  const excitement = Number(body?.excitement ?? 3)

  if (!VALID_STATUS.includes(status)) {
    return NextResponse.json({ error: 'Status must be "have_not_seen" or "already_seen"' }, {
      status: 400,
    })
  }

  if (!VALID_EXCITEMENT.includes(excitement)) {
    return NextResponse.json({
      error: 'Excitement must be 1 (Not excited), 3 (Neutral), or 5 (Excited)',
    }, { status: 400 })
  }

  const { unratedItemIds } = await loadQueueScope(session.user.id)
  if (unratedItemIds.length === 0) {
    return NextResponse.json({ accepted: 0, status, excitement })
  }

  const existing = await prisma.userMediaPreference.findMany({
    where: { userId: session.user.id, mediaItemId: { in: unratedItemIds } },
    select: { mediaItemId: true },
  })

  const existingIds = existing.map((preference) => preference.mediaItemId)
  const existingIdSet = new Set(existingIds)
  const newIds = unratedItemIds.filter((id) => !existingIdSet.has(id))

  const now = new Date()
  const writes = []

  if (existingIds.length > 0) {
    writes.push(prisma.userMediaPreference.updateMany({
      where: { userId: session.user.id, mediaItemId: { in: existingIds } },
      data: {
        status,
        // Matches the single-title route: choosing "have not seen" clears any
        // explicit watched marker.
        ...(status === 'HAVE_NOT_SEEN' ? { isWatched: false } : {}),
        excitement,
        updatedAt: now,
        ratedAt: now,
      },
    }))
  }

  if (newIds.length > 0) {
    writes.push(prisma.userMediaPreference.createMany({
      data: newIds.map((mediaItemId) => ({
        userId: session.user.id as string,
        mediaItemId,
        status,
        isWatched: false,
        excitement,
        updatedAt: now,
        ratedAt: now,
      })),
      skipDuplicates: true,
    }))
  }

  await prisma.$transaction(writes)

  return NextResponse.json({ accepted: unratedItemIds.length, status, excitement })
}
