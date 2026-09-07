import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  filterMediaVisibility,
  getVisibleMemberIds,
  itemsInRoomsWhere,
  loadMembersByRoomId,
  personalCatalogClauses,
  unionMemberIds,
  visiblePreferenceInclude,
  visibleRoomInclude,
} from '@/lib/visibility'
import {
  resolveSubmission,
  resolveVisibleAttribution,
  serializePublicMediaItem,
} from '@/lib/media-attribution'
import { matchMediaSearch, myStatusWhere } from '@/lib/media-search'

// GET /api/media - Get media items from all rooms the user is a member of
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams

  // Get all rooms the user is a member of
  const memberships = await prisma.roomMembership.findMany({
    where: { userId: session.user.id },
    select: { roomId: true },
  })

  const roomIds = memberships.map((m) => m.roomId)
  const myStatus = searchParams.get('myStatus')
  const watched = searchParams.get('watched') === 'true' || myStatus === 'watched'
  const membersByRoomId = await loadMembersByRoomId(roomIds)
  const visiblePrefUserIds = unionMemberIds(membersByRoomId, [session.user.id])

  // Build query filters
  // Check if allRooms mode is requested (show everything: all rooms plus Just My Stuff)
  const allRooms = searchParams.get('allRooms') === 'true'
  let where: any

  if (watched) {
    // "Watched" mode: show items the current user explicitly marked watched.
    where = {
      preferences: {
        some: {
          userId: session.user.id,
          isWatched: true,
        },
      },
    }
  } else if (allRooms) {
    // "Everything" mode: titles in any of my rooms plus my personal catalog.
    // Keep in lockstep with allRoomsCount in GET /api/rooms.
    where = {
      OR: [
        ...(roomIds.length > 0 ? [itemsInRoomsWhere(roomIds)] : []),
        ...personalCatalogClauses(session.user.id),
      ],
    }
  } else {
    // "Just My Stuff" mode: my personal catalog (see personalCatalogClauses).
    where = {
      OR: personalCatalogClauses(session.user.id),
    }
  }

  const filters: any[] = [where]

  // Filter by type
  const type = searchParams.get('type')
  if (type && type !== 'all') {
    filters.push({ type: type.toUpperCase() })
  }

  // Filter by genre
  const genres = searchParams.get('genres')
  if (genres) {
    const genreList = genres.split(',').map((g) => g.trim())
    filters.push({
      genres: {
        contains: JSON.stringify(genreList[0]), // Simple contains check
      },
    })
  }

  // recommendedBy is matched in memory below against the viewer's own preference
  // only; other users' recommender fields are private.
  const recommendedBy = searchParams.get('recommendedBy')

  if (!watched) {
    const statusWhere = myStatusWhere(session.user.id, myStatus)
    if (statusWhere) filters.push(statusWhere)

    // Hide watched items from all non-watched views.
    filters.push({
      NOT: {
        preferences: {
          some: {
            userId: session.user.id,
            isWatched: true,
          },
        },
      },
    })
  }

  // Search is matched in memory over the viewer's scoped set (below), never in SQL:
  // normalization (punctuation/diacritics) can't be expressed there, and household
  // catalogs are small. Reintroduce a SQL prefilter if a catalog grows past a few
  // thousand titles.
  const search = (searchParams.get('search') ?? '').trim()

  const mediaItems = await prisma.mediaItem.findMany({
    where: { AND: filters },
    include: {
      preferences: {
        where: { userId: { in: visiblePrefUserIds } },
        include: visiblePreferenceInclude,
      },
      createdBy: {
        select: { id: true, name: true },
      },
      mediaItemRooms: {
        include: visibleRoomInclude,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  type LoadedItem = (typeof mediaItems)[number]

  const serialize = (item: LoadedItem) => {
    const genres = item.genres ? JSON.parse(item.genres) : []
    const visibility = filterMediaVisibility(item, {
      viewerUserId: session.user.id,
      viewerRoomIds: roomIds,
      membersByRoomId,
    })
    const visibleRoomIds = visibility.rooms.map((room) => room.id)
    const visibleMemberIds = getVisibleMemberIds(visibleRoomIds, membersByRoomId)
    const addedBy = resolveVisibleAttribution(
      item,
      session.user.id,
      visibleRoomIds,
      visibleMemberIds,
    )
    const matchedOn = search
      ? matchMediaSearch(item, search, session.user.id, visibleMemberIds)
      : undefined
    if (matchedOn === null) return null

    return {
      id: item.id,
      title: item.title,
      type: item.type.toLowerCase(),
      tmdbId: item.tmdbId,
      sourceType: item.sourceType.toLowerCase(),
      externalUrl: item.externalUrl,
      posterUrl: item.posterUrl,
      description: item.description,
      genres,
      runtimeMinutes: item.runtimeMinutes,
      rating: item.rating,
      releaseDate: item.releaseDate,
      createdBy: addedBy?.name ?? 'Unknown',
      createdByUserId: addedBy?.id ?? null,
      createdAt: item.createdAt,
      roomName: visibility.rooms[0]?.name ?? null,
      rooms: visibility.rooms,
      myPreference: visibility.myPreference,
      otherPreferences: visibility.otherPreferences,
      preferenceCount: visibility.visiblePreferenceCount,
      submission: resolveSubmission(item, session.user.id, visibleRoomIds, visibleMemberIds),
      ...(matchedOn ? { matchedOn } : {}),
    }
  }

  type SerializedItem = NonNullable<ReturnType<typeof serialize>>
  let items = mediaItems
    .map(serialize)
    .filter((item): item is SerializedItem => item !== null)

  if (recommendedBy && !watched) {
    items = items.filter((item) => item.myPreference?.recommendedByName === recommendedBy)
  }

  // Sort options
  const sortBy = searchParams.get('sortBy') || 'recent'
  if (sortBy === 'myExcitement') {
    items.sort((a, b) => {
      const aExc = a.myPreference?.excitement || 0
      const bExc = b.myPreference?.excitement || 0
      return bExc - aExc
    })
  } else if (sortBy === 'roomExcitement') {
    items.sort((a, b) => b.preferenceCount - a.preferenceCount)
  }

  return NextResponse.json({ items })
}

// POST /api/media - Create a new media item without adding it to any room (for "Just My Stuff")
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const {
      title,
      type,
      tmdbId,
      sourceType,
      externalUrl,
      posterUrl,
      description,
      genres,
      runtimeMinutes,
      rating,
      releaseDate,
      // Preference data
      status,
      excitement,
      notes,
      recommendedByName,
      recommendationContext,
    } = body

    if (!title || !type || !status || !excitement) {
      return NextResponse.json(
        { error: 'Title, type, status, and excitement are required' },
        { status: 400 },
      )
    }

    const validExcitementValues = [1, 3, 5]
    if (!validExcitementValues.includes(parseInt(excitement))) {
      return NextResponse.json({
        error: 'Excitement must be 1 (Not excited), 3 (Neutral), or 5 (Excited)',
      }, { status: 400 })
    }

    const validStatusValues = ['HAVE_NOT_SEEN', 'ALREADY_SEEN']
    const statusUpper = status.toUpperCase()
    if (!validStatusValues.includes(statusUpper)) {
      return NextResponse.json({
        error: 'Status must be "have_not_seen" or "already_seen"',
      }, { status: 400 })
    }

    const validSourceTypes = ['TMDB', 'MANUAL']
    const sourceTypeUpper = typeof sourceType === 'string' ? sourceType.toUpperCase() : ''
    if (!validSourceTypes.includes(sourceTypeUpper)) {
      return NextResponse.json({
        error: 'sourceType must be "tmdb" or "manual"',
      }, { status: 400 })
    }

    // Check if item already exists (by tmdbId if provided)
    let mediaItem = null
    if (tmdbId) {
      const tmdbIdString = String(tmdbId)
      const existingItem = await prisma.mediaItem.findFirst({
        where: { tmdbId: tmdbIdString },
      })
      mediaItem = existingItem
    }

    if (!mediaItem) {
      // Create the global title without any MediaItemRoom join: it lives only in
      // this user's personal catalog until someone adds it to a room.
      mediaItem = await prisma.mediaItem.create({
        data: {
          title: title.trim(),
          type: type.toUpperCase(),
          tmdbId: tmdbId ? String(tmdbId) : null,
          sourceType: sourceTypeUpper,
          externalUrl: externalUrl || null,
          posterUrl: posterUrl || null,
          description: description || null,
          genres: genres ? JSON.stringify(genres) : '[]',
          runtimeMinutes: runtimeMinutes || null,
          rating: rating ? parseFloat(rating) : null,
          releaseDate: releaseDate || null,
          createdByUserId: session.user.id,
        },
      })
    }
    // Existing titles stay in their current rooms. Just My Stuff only upserts
    // this user's preference — it must never strip other households' joins.

    // Create or update user preference
    const now = new Date()
    await prisma.userMediaPreference.upsert({
      where: {
        userId_mediaItemId: {
          userId: session.user.id,
          mediaItemId: mediaItem.id,
        },
      },
      create: {
        userId: session.user.id,
        mediaItemId: mediaItem.id,
        status: status.toUpperCase(),
        isWatched: false,
        excitement: parseInt(excitement),
        notes: notes || null,
        recommendedByName: recommendedByName || null,
        recommendationContext: recommendationContext || null,
        ratedAt: now,
      },
      update: {
        status: status.toUpperCase(),
        isWatched: false,
        excitement: parseInt(excitement),
        notes: notes || null,
        recommendedByName: recommendedByName || null,
        recommendationContext: recommendationContext || null,
        updatedAt: now,
        ratedAt: now,
      },
    })

    return NextResponse.json({ mediaItem: serializePublicMediaItem(mediaItem) })
  } catch (error: any) {
    console.error('Error creating media item:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create media item' },
      { status: 500 },
    )
  }
}
