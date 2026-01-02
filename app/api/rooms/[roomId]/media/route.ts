import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/rooms/[roomId]/media - Get media items with search/filter
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
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
    return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 })
  }

  // Build query filters
  let where: any = { roomId }

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
        select: { id: true, name: true },
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
    // This would require aggregating all preferences - simplified for now
    items.sort((a, b) => b.preferenceCount - a.preferenceCount)
  }

  return NextResponse.json({ items })
}

// POST /api/rooms/[roomId]/media - Create a new media item
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
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
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 })
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
        { status: 400 }
      )
    }

    if (excitement < 1 || excitement > 5) {
      return NextResponse.json({ error: 'Excitement must be between 1 and 5' }, { status: 400 })
    }

    // Check if item already exists (by tmdbId if provided, or by title in room)
    let mediaItem = null
    if (tmdbId) {
      // Convert tmdbId to string as Prisma schema expects String
      const tmdbIdString = String(tmdbId)
      mediaItem = await prisma.mediaItem.findFirst({
        where: { roomId, tmdbId: tmdbIdString },
      })
    }

    if (!mediaItem) {
      // Create new media item
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

