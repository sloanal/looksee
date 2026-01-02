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
  // For "My stuff", only show items created by the current user
  let where: any = {
    roomId: { in: roomIds },
    createdByUserId: session.user.id,
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
      createdBy: item.createdBy.name,
      createdByUserId: item.createdByUserId,
      createdAt: item.createdAt,
      roomName: item.room.name,
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

