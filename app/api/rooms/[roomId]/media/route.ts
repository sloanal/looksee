import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  filterMediaVisibility,
  getVisibleMemberIds,
  itemsInRoomWhere,
  loadMembersByRoomId,
  unionMemberIds,
  visiblePreferenceInclude,
  visibleRoomInclude,
} from '@/lib/visibility'
import {
  buildSourceMeta,
  resolveSubmission,
  resolveVisibleAttribution,
  serializePublicMediaItem,
} from '@/lib/media-attribution'
import { notifyRoomAdditions } from '@/lib/push'
import { matchMediaSearch, myStatusWhere } from '@/lib/media-search'

// GET /api/rooms/[roomId]/media - Get media items with search/filter
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { roomId } = params
  const searchParams = request.nextUrl.searchParams

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

  const viewerMemberships = await prisma.roomMembership.findMany({
    where: { userId: session.user.id },
    select: { roomId: true },
  })
  const viewerRoomIds = viewerMemberships.map((m) => m.roomId)
  const membersByRoomId = await loadMembersByRoomId(viewerRoomIds)
  const focusedMemberIds = unionMemberIds(
    new Map([[roomId, membersByRoomId.get(roomId) ?? new Set<string>()]]),
    [session.user.id],
  )

  // Build query filters - find items that belong to this room via MediaItemRoom
  const filters: any[] = [itemsInRoomWhere(roomId)]

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

  const recommendedBy = searchParams.get('recommendedBy')
  if (recommendedBy) {
    filters.push({
      preferences: {
        some: {
          recommendedByName: recommendedBy,
          userId: { in: focusedMemberIds },
        },
      },
    })
  }

  const myStatus = searchParams.get('myStatus')
  if (myStatus === 'watched') {
    filters.push({
      preferences: { some: { userId: session.user.id, isWatched: true } },
    })
  } else {
    const statusWhere = myStatusWhere(session.user.id, myStatus)
    if (statusWhere) filters.push(statusWhere)

    // Hide items explicitly marked watched by current user from room views.
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

  // Search is matched in memory over the room's scoped set (below), never in SQL:
  // normalization (punctuation/diacritics) can't be expressed there, and household
  // catalogs are small. Reintroduce a SQL prefilter if a catalog grows past a few
  // thousand titles.
  const search = (searchParams.get('search') ?? '').trim()

  const mediaItems = await prisma.mediaItem.findMany({
    where: { AND: filters },
    include: {
      preferences: {
        where: { userId: { in: focusedMemberIds } },
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
      viewerRoomIds,
      focusedRoomId: roomId,
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
      rooms: visibility.rooms,
      myPreference: visibility.myPreference,
      otherPreferences: visibility.otherPreferences,
      preferenceCount: visibility.visiblePreferenceCount,
      submission: resolveSubmission(item, session.user.id, visibleRoomIds, visibleMemberIds),
      ...(matchedOn ? { matchedOn } : {}),
    }
  }

  type SerializedItem = NonNullable<ReturnType<typeof serialize>>
  const items = mediaItems
    .map(serialize)
    .filter((item): item is SerializedItem => item !== null)

  // Sort options
  const sortBy = searchParams.get('sortBy') || 'recent'
  if (sortBy === 'myExcitement') {
    items.sort((a, b) => {
      const aExc = a.myPreference?.excitement || 0
      const bExc = b.myPreference?.excitement || 0
      return bExc - aExc
    })
  } else if (sortBy === 'roomExcitement') {
    // This would require aggregating all preferences - simplified for now
    items.sort((a, b) => b.preferenceCount - a.preferenceCount)
  }

  return NextResponse.json({ items })
}

// POST /api/rooms/[roomId]/media - Create a new media item
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = params
    const body = await request.json()

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

    const sourceMeta = buildSourceMeta(body)

    // Check if item already exists (by tmdbId if provided)
    let mediaItem = null
    let addedToRoom = false
    if (tmdbId) {
      // Convert tmdbId to string as Prisma schema expects String
      const tmdbIdString = String(tmdbId)
      // Find item by tmdbId (globally, not just in this room)
      const itemsWithTmdbId = await prisma.mediaItem.findMany({
        where: { tmdbId: tmdbIdString },
        include: {
          mediaItemRooms: {
            where: { roomId },
          },
        },
      })

      // Check if any of these items are already in this room
      mediaItem = itemsWithTmdbId.find((item) => item.mediaItemRooms.length > 0) ||
        itemsWithTmdbId[0] || null
    }

    if (!mediaItem) {
      // Create new media item
      mediaItem = await prisma.mediaItem.create({
        data: {
          title: title.trim(),
          type: type.toUpperCase(),
          tmdbId: tmdbId ? String(tmdbId) : null,
          sourceType: sourceType.toUpperCase(),
          externalUrl: externalUrl || null,
          posterUrl: posterUrl || null,
          description: description || null,
          genres: genres ? JSON.stringify(genres) : '[]',
          runtimeMinutes: runtimeMinutes || null,
          rating: rating ? parseFloat(rating) : null,
          releaseDate: releaseDate || null,
          createdByUserId: session.user.id,
          mediaItemRooms: {
            create: {
              roomId,
              addedByUserId: session.user.id,
              sourceMeta,
            },
          },
        },
      })
      addedToRoom = true
    } else {
      // Check if this item is already in this room
      const existingRoom = await prisma.mediaItemRoom.findUnique({
        where: {
          mediaItemId_roomId: {
            mediaItemId: mediaItem.id,
            roomId,
          },
        },
      })

      // If not in this room, add it
      if (!existingRoom) {
        await prisma.mediaItemRoom.create({
          data: {
            mediaItemId: mediaItem.id,
            roomId,
            addedByUserId: session.user.id,
            sourceMeta,
          },
        })
        addedToRoom = true
      }
    }

    if (addedToRoom) {
      void notifyRoomAdditions({
        actorUserId: session.user.id,
        roomId,
        mediaItemIds: [mediaItem.id],
      })
    }

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
