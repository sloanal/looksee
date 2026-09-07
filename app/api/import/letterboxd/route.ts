import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildSourceMeta } from '@/lib/media-attribution'
import { notifyRoomAdditions } from '@/lib/push'
import { isTmdbConfigured } from '@/lib/tmdb-client'
import {
  LETTERBOXD_BATCH_SIZE,
  LETTERBOXD_MAX_ROOMS,
  LetterboxdRow,
  parseImportDefaults,
  resolveImportRow,
} from '@/lib/letterboxd'
import { fetchMovieRuntime, LetterboxdMatch, matchLetterboxdRow } from '@/lib/letterboxd-match'

/** One batch from the client. Bigger batches risk the function timeout. */
const MAX_ITEMS = LETTERBOXD_BATCH_SIZE * 2

/** Parallel TMDB lookups. Enough to keep a batch quick, gentle on the rate limit. */
const TMDB_CONCURRENCY = 5

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index])
    }
  })
  await Promise.all(runners)
  return results
}

function parseItems(value: unknown): LetterboxdRow[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ITEMS) return null
  const rows: LetterboxdRow[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null
    const { name, year, rating } = entry as Record<string, unknown>
    if (typeof name !== 'string' || name.trim().length === 0) return null
    rows.push({
      name: name.trim().slice(0, 200),
      year: typeof year === 'number' && isFinite(year) ? Math.trunc(year) : null,
      rating: typeof rating === 'number' && rating >= 0.5 && rating <= 5 ? rating : null,
    })
  }
  return rows
}

/** Accepts the `roomIds` list, or the single `roomId` older clients still send. */
function parseRoomIds(body: unknown): string[] {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const raw = Array.isArray(input.roomIds) ? input.roomIds : [input.roomId]
  const ids = raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
  return Array.from(new Set(ids)).slice(0, LETTERBOXD_MAX_ROOMS)
}

/**
 * POST /api/import/letterboxd - import one batch of rows from a Letterboxd CSV
 * export into the caller's library, optionally adding them to rooms too.
 *
 * Each row is matched against TMDB and stored exactly like a title added by
 * hand: the global MediaItem is reused when the film is already in the catalog
 * (titles are global per tmdbId), each room gets a MediaItemRoom join, and the
 * caller gets a UserMediaPreference.
 *
 * A row the export has no opinion about lands on the status and excitement the
 * caller picked in the import dialog; a row that carries stars keeps them, as
 * already seen with the stars mapped onto excitement. Either way it counts as
 * a real rating (ratedAt is set), because the caller chose the values — they
 * are not asked to rate the same films again one at a time.
 *
 * Titles the caller has already seen stay out of every room — same rule as
 * POST /api/rooms/[roomId]/import-watchlist, where only want-to-watch titles
 * enter a shared space, so nobody else's queue fills up with a watch history.
 *
 * An existing preference is never overwritten: a rating the caller made in the
 * app always wins over whatever the export or the dialog says.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  if (!isTmdbConfigured()) {
    return NextResponse.json({ error: 'Title lookup is not configured' }, { status: 500 })
  }

  const body = await request.json().catch(() => null)
  const items = parseItems((body as { items?: unknown } | null)?.items)
  if (!items) {
    return NextResponse.json(
      { error: `Send between 1 and ${MAX_ITEMS} films to import` },
      { status: 400 },
    )
  }

  const roomIds = parseRoomIds(body)
  const defaults = parseImportDefaults((body as { defaults?: unknown } | null)?.defaults)

  if (roomIds.length > 0) {
    const memberships = await prisma.roomMembership.findMany({
      where: { userId, roomId: { in: roomIds } },
      select: { roomId: true },
    })
    if (memberships.length !== roomIds.length) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 })
    }
  }

  try {
    const matches = await mapWithConcurrency(items, TMDB_CONCURRENCY, matchLetterboxdRow)

    // Two rows can resolve to the same film (different spellings, or a
    // watchlist and a rating for one title in the same batch); keep the first.
    const rowByTmdbId = new Map<string, LetterboxdRow>()
    const matchByTmdbId = new Map<string, LetterboxdMatch>()
    const unmatched: string[] = []
    items.forEach((row, index) => {
      const match = matches[index]
      if (!match) {
        unmatched.push(row.name)
        return
      }
      if (matchByTmdbId.has(match.tmdbId)) return
      matchByTmdbId.set(match.tmdbId, match)
      rowByTmdbId.set(match.tmdbId, row)
    })

    const tmdbIds = Array.from(matchByTmdbId.keys())
    if (tmdbIds.length === 0) {
      return NextResponse.json({ added: 0, addedToRoom: 0, seen: 0, alreadyThere: 0, unmatched })
    }

    const existingItems = await prisma.mediaItem.findMany({
      where: { tmdbId: { in: tmdbIds } },
      select: { id: true, tmdbId: true },
    })
    const existingIds = existingItems.map((item) => item.id)

    const [existingJoins, existingPreferences] = await Promise.all([
      roomIds.length > 0 && existingIds.length > 0
        ? prisma.mediaItemRoom.findMany({
          where: { roomId: { in: roomIds }, mediaItemId: { in: existingIds } },
          select: { mediaItemId: true, roomId: true },
        })
        : Promise.resolve([]),
      existingIds.length > 0
        ? prisma.userMediaPreference.findMany({
          where: { userId, mediaItemId: { in: existingIds } },
          select: { mediaItemId: true },
        })
        : Promise.resolve([]),
    ])
    const joinedIds = new Set(existingJoins.map((join) => join.mediaItemId))
    const joinedByRoom = new Map(roomIds.map((id) => [id, new Set<string>()]))
    for (const join of existingJoins) joinedByRoom.get(join.roomId)?.add(join.mediaItemId)
    const ratedIds = new Set(existingPreferences.map((preference) => preference.mediaItemId))

    // The catalog can hold more than one row per tmdbId (pre-dedupe history),
    // so prefer the copy that is already in one of these rooms, then one the
    // caller already has a preference on.
    const rank = (mediaItemId: string) =>
      (joinedIds.has(mediaItemId) ? 2 : 0) + (ratedIds.has(mediaItemId) ? 1 : 0)
    const idByTmdbId = new Map<string, string>()
    for (const item of existingItems) {
      if (!item.tmdbId) continue
      const current = idByTmdbId.get(item.tmdbId)
      if (!current || rank(item.id) > rank(current)) idByTmdbId.set(item.tmdbId, item.id)
    }

    const missingTmdbIds = tmdbIds.filter((tmdbId) => !idByTmdbId.has(tmdbId))
    if (missingTmdbIds.length > 0) {
      const runtimes = await mapWithConcurrency(
        missingTmdbIds,
        TMDB_CONCURRENCY,
        fetchMovieRuntime,
      )
      await prisma.mediaItem.createMany({
        data: missingTmdbIds.map((tmdbId, index) => {
          const match = matchByTmdbId.get(tmdbId)!
          return {
            title: match.title,
            type: 'MOVIE',
            tmdbId,
            sourceType: 'TMDB',
            posterUrl: match.posterUrl,
            description: match.description,
            genres: JSON.stringify(match.genres),
            runtimeMinutes: runtimes[index],
            rating: match.rating,
            releaseDate: match.releaseDate,
            createdByUserId: userId,
          }
        }),
      })
      // createMany can't return ids; these rows are this caller's newest for
      // each tmdbId, and anything pre-existing was already resolved above.
      const created = await prisma.mediaItem.findMany({
        where: { tmdbId: { in: missingTmdbIds }, createdByUserId: userId },
        select: { id: true, tmdbId: true },
        orderBy: { createdAt: 'desc' },
      })
      for (const item of created) {
        if (item.tmdbId && !idByTmdbId.has(item.tmdbId)) idByTmdbId.set(item.tmdbId, item.id)
      }
    }

    const resolved = tmdbIds
      .map((tmdbId) => ({
        mediaItemId: idByTmdbId.get(tmdbId),
        row: rowByTmdbId.get(tmdbId)!,
      }))
      .filter((entry): entry is { mediaItemId: string; row: LetterboxdRow } =>
        entry.mediaItemId !== undefined
      )

    const landing = new Map(
      resolved.map((entry) => [entry.mediaItemId, resolveImportRow(entry.row, defaults)]),
    )
    // Only films the caller has not seen are worth putting in front of everyone
    // else, so an "already seen" import fills the library and no room.
    const shareable = resolved.filter((entry) =>
      landing.get(entry.mediaItemId)!.status === 'HAVE_NOT_SEEN'
    )

    const newJoinsByRoom = roomIds.map((roomId) => ({
      roomId,
      mediaItemIds: shareable
        .filter((entry) => !joinedByRoom.get(roomId)?.has(entry.mediaItemId))
        .map((entry) => entry.mediaItemId),
    }))

    const joinRows = newJoinsByRoom.flatMap(({ roomId, mediaItemIds }) =>
      mediaItemIds.map((mediaItemId) => ({ mediaItemId, roomId }))
    )
    if (joinRows.length > 0) {
      const sourceMeta = buildSourceMeta(body, { importedFrom: 'letterboxd' })
      await prisma.mediaItemRoom.createMany({
        data: joinRows.map((join) => ({ ...join, addedByUserId: userId, sourceMeta })),
        skipDuplicates: true,
      })
    }

    // The caller picked these values for the whole file, so they are a real
    // rating (ratedAt set) rather than the placeholder a favorite-only row
    // leaves behind — the same films should not come back in the New queue.
    const now = new Date()
    const newPreferences = resolved
      .filter((entry) => !ratedIds.has(entry.mediaItemId))
      .map(({ mediaItemId }) => ({
        userId,
        mediaItemId,
        ...landing.get(mediaItemId)!,
        ratedAt: now,
      }))

    if (newPreferences.length > 0) {
      await prisma.userMediaPreference.createMany({
        data: newPreferences,
        skipDuplicates: true,
      })
    }

    for (const { roomId, mediaItemIds } of newJoinsByRoom) {
      if (mediaItemIds.length === 0) continue
      void notifyRoomAdditions({ actorUserId: userId, roomId, mediaItemIds })
    }

    const newPreferenceIds = new Set(newPreferences.map((preference) => preference.mediaItemId))
    const newJoinIdSet = new Set(joinRows.map((join) => join.mediaItemId))
    // "Added" means new to the caller: a preference or a room join was created.
    const added = resolved.filter((entry) =>
      newPreferenceIds.has(entry.mediaItemId) || newJoinIdSet.has(entry.mediaItemId)
    ).length
    const seen = newPreferences.filter((preference) =>
      preference.isWatched
    ).length

    return NextResponse.json({
      added,
      // Titles that reached at least one room, not the number of joins, so the
      // client can say "N of them are in Movie Night and Sunday Club".
      addedToRoom: newJoinIdSet.size,
      seen,
      alreadyThere: resolved.length - added,
      unmatched,
    })
  } catch (error: any) {
    console.error('Error importing from Letterboxd:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import from Letterboxd' },
      { status: 500 },
    )
  }
}
