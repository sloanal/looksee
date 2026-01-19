import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

  if (roomIds.length === 0) {
    return NextResponse.json({ items: [] })
  }

  // Build query filters
  // Check if allRooms mode is requested (show everything: all rooms plus Just My Stuff)
  const allRooms = searchParams.get('allRooms') === 'true'
  let where: any
  
  if (allRooms) {
    // "Everything" mode: show all items from rooms the user is a member of
    // PLUS items created by the user with no room associations (Just My Stuff)
    where = {
      OR: [
        {
          mediaItemRooms: {
            some: {
              roomId: { in: roomIds },
            },
          },
        },
        {
          createdByUserId: session.user.id,
          mediaItemRooms: {
            none: {}, // Items with no room associations
          },
        },
      ],
    }
  } else {
    // "My stuff" mode: show items created by the user that either:
    // 1. Have no MediaItemRoom entries (items added via "Just My Stuff")
    // 2. Or have MediaItemRoom entries in rooms the user is a member of
    where = {
      createdByUserId: session.user.id,
      OR: [
        {
          mediaItemRooms: {
            none: {}, // Items with no room associations
          },
        },
        {
          mediaItemRooms: {
            some: {
              roomId: { in: roomIds },
            },
          },
        },
      ],
    }
  }

  // Search by title
  const search = searchParams.get('search')
  if (search) {
    // PostgreSQL supports case-insensitive search
    where.title = { contains: search, mode: 'insensitive' }
  }

  // Filter by type
  const type = searchParams.get('type')
  if (type && type !== 'all') {
    where.type = type.toUpperCase()
  }

  // Filter by genre
  const genres = searchParams.get('genres')
  if (genres) {
    const genreList = genres.split(',').map((g) => g.trim())
    where.genres = {
      contains: JSON.stringify(genreList[0]), // Simple contains check
    }
  }

  // Build preferences filters - handle both recommendedBy and myStatus
  const recommendedBy = searchParams.get('recommendedBy')
  const myStatus = searchParams.get('myStatus')
  
  if (recommendedBy && (myStatus && myStatus !== 'unrated')) {
    // Both filters: need items that have BOTH conditions
    // Item must have a preference with recommendedByName AND
    // the current user must have a preference with the specified status
    // We need to combine base conditions with preference filters using AND
    const baseConditions: any = { ...where }
    delete baseConditions.preferences
    delete baseConditions.AND
    
    where = {
      AND: [
        baseConditions,
        {
          preferences: {
            some: {
              recommendedByName: recommendedBy,
            },
          },
        },
        {
          preferences: {
            some: {
              userId: session.user.id,
              status: myStatus.toUpperCase(),
            },
          },
        },
      ],
    }
  } else if (recommendedBy) {
    where.preferences = {
      some: {
        recommendedByName: recommendedBy,
      },
    }
  } else if (myStatus && myStatus !== 'unrated') {
    where.preferences = {
      some: {
        userId: session.user.id,
        status: myStatus.toUpperCase(),
      },
    }
  }

  // Get media items with all preferences (including user info)
  const mediaItems = await prisma.mediaItem.findMany({
    where,
    include: {
      preferences: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
      },
      createdBy: {
        select: { name: true },
      },
      room: {
        select: { id: true, name: true },
      },
      mediaItemRooms: {
        include: {
          room: {
            select: { id: true, name: true },
          },
          addedBy: {
            select: { id: true, name: true },
          },
        },
      },
      _count: {
        select: { preferences: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const items = mediaItems.map((item) => {
    const genres = item.genres ? JSON.parse(item.genres) : []
    
    // Find current user's preference
    const myPref = item.preferences.find((p) => p.userId === session.user.id)
    
    // Get other users' preferences (exclude current user)
    const otherPreferences = item.preferences
      .filter((p) => p.userId !== session.user.id)
      .map((p) => ({
        status: p.status.toLowerCase(),
        excitement: p.excitement,
        user: {
          id: p.user.id,
          name: p.user.name,
          imageUrl: p.user.imageUrl,
        },
      }))

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
      createdBy: item.createdBy.name,
      createdByUserId: item.createdByUserId,
      createdAt: item.createdAt,
      roomName: item.room.name,
      rooms: item.mediaItemRooms.map((mir) => ({
        id: mir.room.id,
        name: mir.room.name,
        addedByUserId: mir.addedByUserId,
        addedByName: mir.addedBy.name,
      })),
      myPreference: myPref
        ? {
            status: myPref.status.toLowerCase(),
            excitement: myPref.excitement,
            notes: myPref.notes,
            recommendedByName: myPref.recommendedByName,
            recommendationContext: myPref.recommendationContext,
          }
        : null,
      otherPreferences,
      preferenceCount: item._count.preferences,
    }
  })

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
        { status: 400 }
      )
    }

    const validExcitementValues = [1, 3, 5]
    if (!validExcitementValues.includes(parseInt(excitement))) {
      return NextResponse.json({ error: 'Excitement must be 1 (Not excited), 3 (Neutral), or 5 (Excited)' }, { status: 400 })
    }

    const validStatusValues = ['HAVE_NOT_SEEN', 'ALREADY_SEEN']
    const statusUpper = status.toUpperCase()
    if (!validStatusValues.includes(statusUpper)) {
      return NextResponse.json({ error: 'Status must be "have_not_seen" or "already_seen"' }, { status: 400 })
    }

    // Get user's first room for the required roomId field (backward compatibility)
    // The item won't be added to any room because we don't create a MediaItemRoom entry
    let memberships = await prisma.roomMembership.findMany({
      where: { userId: session.user.id },
      select: { roomId: true },
      take: 1,
    })

    let roomId: string

    // If user has no rooms, automatically create a default personal room
    if (memberships.length === 0) {
      const { generateInviteCode } = await import('@/lib/utils')
      
      // Generate unique invite code
      let inviteCode = generateInviteCode()
      let exists = await prisma.room.findUnique({ where: { inviteCode } })
      while (exists) {
        inviteCode = generateInviteCode()
        exists = await prisma.room.findUnique({ where: { inviteCode } })
      }

      const defaultRoom = await prisma.room.create({
        data: {
          name: 'My Stuff',
          inviteCode,
          memberships: {
            create: {
              userId: session.user.id,
              role: 'owner',
            },
          },
        },
      })

      roomId = defaultRoom.id
    } else {
      roomId = memberships[0].roomId
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
      // Create new media item without adding it to any room
      // We set roomId for backward compatibility, but don't create a MediaItemRoom entry
      mediaItem = await prisma.mediaItem.create({
        data: {
          roomId,
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
          // Note: We intentionally do NOT create a MediaItemRoom entry
          // This means the item won't appear in any room's media list
        },
      })
    }

    // Create or update user preference
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
        excitement: parseInt(excitement),
        notes: notes || null,
        recommendedByName: recommendedByName || null,
        recommendationContext: recommendationContext || null,
      },
      update: {
        status: status.toUpperCase(),
        excitement: parseInt(excitement),
        notes: notes || null,
        recommendedByName: recommendedByName || null,
        recommendationContext: recommendationContext || null,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ mediaItem })
  } catch (error: any) {
    console.error('Error creating media item:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create media item' },
      { status: 500 }
    )
  }
}

