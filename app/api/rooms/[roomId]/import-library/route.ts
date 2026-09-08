import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyRoomAdditions } from '@/lib/push'
import { buildSourceMeta } from '@/lib/media-attribution'
import {
  LIBRARY_GROUP_KEYS,
  LIBRARY_PICK_LIMIT,
  LibraryGroupKey,
  libraryItemGroups,
  parseLibraryGroups,
} from '@/lib/library-groups'

type Db = Prisma.TransactionClient | typeof prisma

/** Everything in the caller's own library: what they rated, plus what they added. */
function myLibraryWhere(userId: string) {
  return {
    OR: [
      { preferences: { some: { userId } } },
      { createdByUserId: userId },
    ],
  }
}

type Candidate = {
  id: string
  title: string
  type: string
  posterUrl: string | null
  releaseDate: string | null
  inRoom: boolean
  groups: LibraryGroupKey[]
}

/**
 * The caller's library, each title tagged with the groups it belongs to and
 * whether the room already has it. One read serves the counts, the checklist
 * and the import, so all three agree on what a group means.
 */
async function loadCandidates(db: Db, userId: string, roomId: string): Promise<Candidate[]> {
  const items = await db.mediaItem.findMany({
    where: myLibraryWhere(userId),
    select: {
      id: true,
      title: true,
      type: true,
      posterUrl: true,
      releaseDate: true,
      createdByUserId: true,
      preferences: {
        where: { userId },
        select: { status: true, isWatched: true, isFavorite: true, excitement: true },
        take: 1,
      },
      mediaItemRooms: { where: { roomId }, select: { id: true } },
    },
    orderBy: { title: 'asc' },
  })

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    posterUrl: item.posterUrl,
    releaseDate: item.releaseDate,
    inRoom: item.mediaItemRooms.length > 0,
    groups: libraryItemGroups({
      createdByMe: item.createdByUserId === userId,
      preference: item.preferences[0] ?? null,
    }),
  }))
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

// GET /api/rooms/[roomId]/import-library - what the caller could add, by group
export async function GET(
  _request: NextRequest,
  { params }: { params: { roomId: string } },
) {
  const auth = await authorize(params.roomId)
  if ('error' in auth) return auth.error

  const candidates = await loadCandidates(prisma, auth.userId, params.roomId)
  const missing = candidates.filter((candidate) => !candidate.inRoom)

  return NextResponse.json({
    groups: LIBRARY_GROUP_KEYS.map((key) => ({
      key,
      count: missing.filter((candidate) => candidate.groups.includes(key)).length,
    })),
    candidateCount: missing.length,
    libraryCount: candidates.length,
    titles: missing.slice(0, LIBRARY_PICK_LIMIT).map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      type: candidate.type,
      posterUrl: candidate.posterUrl,
      releaseDate: candidate.releaseDate,
      groups: candidate.groups,
    })),
    truncated: missing.length > LIBRARY_PICK_LIMIT,
  })
}

// POST /api/rooms/[roomId]/import-library - add the chosen groups/titles to the room
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } },
) {
  const auth = await authorize(params.roomId)
  if ('error' in auth) return auth.error

  const { roomId } = params
  const { userId } = auth
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const sourceMeta = buildSourceMeta(body)

  const groups = parseLibraryGroups(body?.groups)
  const picked = Array.isArray(body?.mediaItemIds) ? body?.mediaItemIds as unknown[] : []
  const pickedIds = new Set(
    picked.filter((id): id is string => typeof id === 'string').slice(0, LIBRARY_PICK_LIMIT),
  )

  if (groups.length === 0 && pickedIds.size === 0) {
    return NextResponse.json(
      { error: 'Pick at least one group or title to add' },
      { status: 400 },
    )
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const candidates = await loadCandidates(tx, userId, roomId)
      const selected = candidates.filter((candidate) =>
        pickedIds.has(candidate.id) ||
        candidate.groups.some((group) => groups.includes(group))
      )
      const missingIds = selected
        .filter((candidate) => !candidate.inRoom)
        .map((candidate) => candidate.id)

      const created = missingIds.length === 0 ? { count: 0 } : await tx.mediaItemRoom.createMany({
        data: missingIds.map((mediaItemId) => ({
          mediaItemId,
          roomId,
          addedByUserId: userId,
          sourceMeta,
        })),
        skipDuplicates: true,
      })

      return {
        added: created.count,
        skipped: selected.length - created.count,
        total: selected.length,
        addedIds: missingIds,
      }
    })

    const { addedIds, ...counts } = result
    if (counts.added > 0) {
      void notifyRoomAdditions({ actorUserId: userId, roomId, mediaItemIds: addedIds })
    }

    return NextResponse.json(counts)
  } catch (error: any) {
    console.error('Error adding library titles to room:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add your titles' },
      { status: 500 },
    )
  }
}
