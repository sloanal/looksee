import { prisma } from '@/lib/prisma'
import { movieGenres, tvGenres } from '@/lib/tmdb-genres'
import {
  filterMediaVisibility,
  getVisibleMemberIds,
  itemsInRoomsWhere,
  loadMembersByRoomId,
  personalCatalogClauses,
  restrictPreferencesToVisibleUsers,
  unionMemberIds,
  VisibleMyPreference,
  VisibleOtherPreference,
  visiblePreferenceInclude,
  visibleRoomInclude,
} from '@/lib/visibility'
import { resolveSubmission, SubmissionInfo } from '@/lib/media-attribution'

// Favorites lift a title past one full excitement step (1 → 3 → 5), so a
// neutral favorite outranks an otherwise-equal excited non-favorite. In room
// modes the boost stacks per favoriting member but never crosses the
// interestedCount tier, and it is only a sort key: watched/seen filtering
// happens before ranking and is unaffected.
export const FAVORITE_BOOST = 2.5

export type RecommendationMode = 'me' | 'room'

export type RecommendationRequest = {
  viewerUserId: string
  /** `null` = Just My Stuff, `'all-rooms'`, `'watched'`, or a room id. */
  roomId: string | null
  mode: RecommendationMode
  typePreference?: string | null
  genres?: Array<string | number> | null
  showSeenAndNoExcitement?: boolean
}

export type RecommendationResult = {
  id: string
  title: string
  type: string
  tmdbId: string | null
  sourceType: string | undefined
  posterUrl: string | null
  description: string | null
  genres: string[]
  runtimeMinutes: number | null
  rating: number | null
  releaseDate: string | null
  myExcitement: number | null
  myStatus: string | null
  isFavorite: boolean
  favoritedBy: string[]
  interestedCount: number
  avgExcitement: number
  myPreference: VisibleMyPreference | null
  otherPreferences: VisibleOtherPreference[]
  submission: SubmissionInfo
}

export type RecommendationOutcome =
  | { ok: true; recommendations: RecommendationResult[] }
  | { ok: false; status: number; error: string }

// Calculate a lightweight recency score (0-1, where 1 is most recent)
// Items created within the last 30 days get full score, then it decays
function getRecencyScore(createdAt: Date): number {
  const now = new Date()
  const daysSinceCreation = (now.getTime() - createdAt.getTime()) /
    (1000 * 60 * 60 * 24)

  if (daysSinceCreation <= 30) {
    return 1.0
  }
  if (daysSinceCreation <= 90) {
    return 1.0 - ((daysSinceCreation - 30) / 60) * 0.5
  }
  if (daysSinceCreation <= 365) {
    return 0.5 - ((daysSinceCreation - 90) / 275) * 0.5
  }
  return 0.0
}

// Shared tail of both rankings: ratings that differ by more than half a
// point win, otherwise recency nudges, and exact creation time breaks ties.
function compareByRatingThenRecency(
  a: { rating: number | null; createdAt: Date },
  b: { rating: number | null; createdAt: Date },
): number {
  const aRating = a.rating || 0
  const bRating = b.rating || 0
  if (Math.abs(bRating - aRating) > 0.5) {
    return bRating - aRating
  }
  const aRecency = getRecencyScore(a.createdAt)
  const bRecency = getRecencyScore(b.createdAt)
  if (bRecency !== aRecency) return bRecency - aRecency
  return b.createdAt.getTime() - a.createdAt.getTime()
}

function selectedGenreNamesFor(
  genres: Array<string | number> | null | undefined,
  typePreference: string | null | undefined,
): string[] {
  const names: string[] = []
  if (!genres || genres.length === 0) return names

  const genreIds = genres
    .map((g) => typeof g === 'string' ? parseInt(g, 10) : g)
    .filter((g) => !isNaN(g))

  if (typePreference === 'movie') {
    genreIds.forEach((id) => {
      const name = movieGenres[id]
      if (name) names.push(name)
    })
  } else if (typePreference === 'show') {
    genreIds.forEach((id) => {
      const name = tvGenres[id]
      if (name) names.push(name)
    })
  } else {
    genreIds.forEach((id) => {
      const movieName = movieGenres[id]
      const tvName = tvGenres[id]
      if (movieName) names.push(movieName)
      if (tvName && tvName !== movieName) names.push(tvName)
    })
  }
  return names
}

function parseGenres(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Ranked "what should we watch" candidates for one viewer.
 *
 * Catalog: a specific room's titles (rooms-only), the viewer's personal
 * catalog (Just My Stuff), or — for All Rooms — the union of the viewer's rooms
 * and their personal catalog, exactly what Browse lists via
 * GET /api/media?allRooms=true and what allRoomsCount in GET /api/rooms counts.
 * A viewer with no rooms therefore gets their personal catalog for All Rooms.
 *
 * Every preference that leaves this function has passed filterMediaVisibility:
 * only the viewer plus current members of rooms they share with the title are
 * ever serialized, and a focused room never leaks sibling-room members.
 */
export async function buildRecommendations(
  input: RecommendationRequest,
): Promise<RecommendationOutcome> {
  const { viewerUserId, roomId, mode } = input

  if (roomId === 'watched') {
    return { ok: true, recommendations: [] }
  }

  const memberships = await prisma.roomMembership.findMany({
    where: { userId: viewerUserId },
    select: { roomId: true },
  })
  const viewerRoomIds = memberships.map((m) => m.roomId)

  let focusedRoomId: string | undefined
  let where: any
  if (roomId === 'all-rooms') {
    // Keep in lockstep with GET /api/media?allRooms=true and allRoomsCount.
    where = {
      OR: [
        ...(viewerRoomIds.length > 0 ? [itemsInRoomsWhere(viewerRoomIds)] : []),
        ...personalCatalogClauses(viewerUserId),
      ],
    }
  } else if (!roomId) {
    where = { OR: personalCatalogClauses(viewerUserId) }
  } else {
    if (!viewerRoomIds.includes(roomId)) {
      return { ok: false, status: 403, error: 'Not a member of this room' }
    }
    focusedRoomId = roomId
    where = itemsInRoomsWhere([roomId])
  }

  if (input.typePreference && input.typePreference !== 'any') {
    where.type = input.typePreference.toUpperCase()
  }

  const selectedGenreNames = selectedGenreNamesFor(input.genres, input.typePreference)

  const membersByRoomId = await loadMembersByRoomId(viewerRoomIds)
  const scope = {
    viewerUserId,
    viewerRoomIds,
    focusedRoomId,
    membersByRoomId,
  }

  const rawItems = await prisma.mediaItem.findMany({
    where,
    include: {
      preferences: {
        where: { userId: { in: unionMemberIds(membersByRoomId, [viewerUserId]) } },
        include: visiblePreferenceInclude,
      },
      createdBy: {
        select: { id: true, name: true },
      },
      mediaItemRooms: {
        include: visibleRoomInclude,
      },
    },
  })

  const items = rawItems
    .map((item) => {
      const preferences = restrictPreferencesToVisibleUsers(item.preferences, {
        ...scope,
        mediaItemRooms: item.mediaItemRooms,
      })
      const myPref = preferences.find((p) => p.userId === viewerUserId)
      return { ...item, preferences, myPref, genreNames: parseGenres(item.genres) }
    })
    .filter((item) => {
      if (selectedGenreNames.length > 0) {
        if (!item.genreNames.some((genre) => selectedGenreNames.includes(genre))) return false
      }
      return !item.myPref?.isWatched
    })

  const serialize = (
    item: (typeof items)[number],
    interested: { excitement: number }[],
  ): RecommendationResult => {
    const visibility = filterMediaVisibility(item, scope)
    const visibleRoomIds = visibility.rooms.map((room) => room.id)
    const totalExcitement = interested.reduce((sum, p) => sum + p.excitement, 0)
    const avgExcitement = interested.length > 0 ? totalExcitement / interested.length : 0

    return {
      id: item.id,
      title: item.title,
      type: item.type.toLowerCase(),
      tmdbId: item.tmdbId,
      sourceType: item.sourceType?.toLowerCase(),
      posterUrl: item.posterUrl,
      description: item.description,
      genres: item.genreNames,
      runtimeMinutes: item.runtimeMinutes,
      rating: item.rating,
      releaseDate: item.releaseDate,
      myExcitement: item.myPref?.excitement || (mode === 'me' ? 0 : null),
      myStatus: item.myPref?.status.toLowerCase() || null,
      isFavorite: item.myPref?.isFavorite === true,
      favoritedBy: visibility.otherPreferences
        .filter((p) => p.isFavorite)
        .map((p) => p.user.name),
      interestedCount: interested.length,
      avgExcitement: Math.round(avgExcitement * 10) / 10,
      myPreference: visibility.myPreference,
      otherPreferences: visibility.otherPreferences,
      submission: resolveSubmission(
        item,
        viewerUserId,
        visibleRoomIds,
        getVisibleMemberIds(visibleRoomIds, membersByRoomId),
      ),
    }
  }

  const interestedOf = (item: (typeof items)[number]) =>
    item.preferences.filter((p) => p.status === 'HAVE_NOT_SEEN')

  if (mode === 'me') {
    // Just me: only titles the viewer wants to see, ranked by the viewer's
    // own excitement (+ favorite boost).
    const myItems = items.filter((item) => item.myPref?.status === 'HAVE_NOT_SEEN')

    myItems.sort((a, b) => {
      const aExc = (a.myPref?.excitement || 0) + (a.myPref?.isFavorite ? FAVORITE_BOOST : 0)
      const bExc = (b.myPref?.excitement || 0) + (b.myPref?.isFavorite ? FAVORITE_BOOST : 0)
      if (bExc !== aExc) return bExc - aExc
      return compareByRatingThenRecency(a, b)
    })

    const results = myItems
      .map((item) => {
        const seenCount = item.preferences.filter((p) => p.status === 'ALREADY_SEEN').length
        return { result: serialize(item, interestedOf(item)), seenCount }
      })
      .filter(({ result, seenCount }) => {
        // Optional narrowing: titles others have seen that nobody but the
        // viewer is still excited about.
        if (input.showSeenAndNoExcitement) {
          return seenCount > 0 && result.interestedCount === 1
        }
        return true
      })
      .map(({ result }) => result)

    return { ok: true, recommendations: results }
  }

  // Everyone: rank by how many visible members want to see it, then average
  // excitement (+ per-favorite boost). Personal-catalog titles that sit in none
  // of the viewer's rooms have no household signal, so they are left out here
  // (they still surface in Just Me).
  const viewerRoomIdSet = new Set(viewerRoomIds)
  const requireViewerRoom = roomId === 'all-rooms'
  const roomItems = items
    .map((item) => {
      const inAViewerRoom = item.mediaItemRooms.some((mir: { roomId: string }) =>
        viewerRoomIdSet.has(mir.roomId)
      )
      if (requireViewerRoom && !inAViewerRoom) return null
      const interested = interestedOf(item)
      if (interested.length === 0) return null
      const totalExcitement = interested.reduce((sum, p) => sum + p.excitement, 0)
      return {
        item,
        interested,
        interestedCount: interested.length,
        avgExcitement: totalExcitement / interested.length,
        favoriteCount: item.preferences.filter((p) => p.isFavorite).length,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  roomItems.sort((a, b) => {
    if (b.interestedCount !== a.interestedCount) {
      return b.interestedCount - a.interestedCount
    }
    const aScore = a.avgExcitement + FAVORITE_BOOST * a.favoriteCount
    const bScore = b.avgExcitement + FAVORITE_BOOST * b.favoriteCount
    if (bScore !== aScore) {
      return bScore - aScore
    }
    return compareByRatingThenRecency(a.item, b.item)
  })

  return {
    ok: true,
    recommendations: roomItems.map(({ item, interested }) => serialize(item, interested)),
  }
}
