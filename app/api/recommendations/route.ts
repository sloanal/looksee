import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { movieGenres, tvGenres } from '@/lib/tmdb-genres'

// Calculate a lightweight recency score (0-1, where 1 is most recent)
// Items created within the last 30 days get full score, then it decays
function getRecencyScore(createdAt: Date): number {
  const now = new Date()
  const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  
  // Items from last 30 days: full score (1.0)
  if (daysSinceCreation <= 30) {
    return 1.0
  }
  
  // Items from last 90 days: 0.5-1.0 (linear decay)
  if (daysSinceCreation <= 90) {
    return 1.0 - ((daysSinceCreation - 30) / 60) * 0.5
  }
  
  // Items older than 90 days: 0.0-0.5 (linear decay over 1 year)
  if (daysSinceCreation <= 365) {
    return 0.5 - ((daysSinceCreation - 90) / 275) * 0.5
  }
  
  // Items older than 1 year: minimal score (0.0)
  return 0.0
}

// POST /api/recommendations - Get watch recommendations for "Just My Stuff", "All Rooms", or a specific room
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const roomId = searchParams.get('roomId')
  const body = await request.json()

  const { mode, typePreference, genres, showSeenAndNoExcitement } = body

  // Get all rooms the user is a member of
  const memberships = await prisma.roomMembership.findMany({
    where: { userId: session.user.id },
    select: { roomId: true },
  })
  const userRoomIds = memberships.map((m) => m.roomId)

  if (userRoomIds.length === 0) {
    return NextResponse.json({ recommendations: [] })
  }

  let targetRoomIds: string[] = []
  let memberIds: string[] = []
  let isJustMyStuff = false

  if (roomId === 'watched') {
    return NextResponse.json({ recommendations: [] })
  } else if (roomId === 'all-rooms') {
    // All Rooms: use all rooms the user is a member of
    targetRoomIds = userRoomIds
    memberIds = [session.user.id] // Will be expanded later for room mode
  } else if (!roomId) {
    // Just My Stuff: use all rooms but only show items created by user
    targetRoomIds = userRoomIds
    isJustMyStuff = true
    memberIds = [session.user.id] // Will be expanded later for room mode
  } else {
    // Specific room: verify membership and use that room
    if (!userRoomIds.includes(roomId)) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 })
    }
    targetRoomIds = [roomId]
    const roomMembers = await prisma.roomMembership.findMany({
      where: { roomId },
      select: { userId: true },
    })
    memberIds = roomMembers.map((m) => m.userId)
  }

  // Build query filters
  const where: any = { roomId: { in: targetRoomIds } }

  // For "Just My Stuff", only show items created by the user
  if (isJustMyStuff) {
    where.createdByUserId = session.user.id
  }

  // Filter by type
  if (typePreference && typePreference !== 'any') {
    where.type = typePreference.toUpperCase()
  }

  // Convert genre IDs to genre names for matching (database stores genre names, not IDs)
  const selectedGenreNames: string[] = []
  if (genres && genres.length > 0) {
    const genreIds = genres.map((g: string | number) => typeof g === 'string' ? parseInt(g, 10) : g).filter((g: number) => !isNaN(g))
    
    // Convert IDs to names based on type preference
    if (typePreference === 'movie') {
      genreIds.forEach((id: number) => {
        const name = movieGenres[id]
        if (name) selectedGenreNames.push(name)
      })
    } else if (typePreference === 'show') {
      genreIds.forEach((id: number) => {
        const name = tvGenres[id]
        if (name) selectedGenreNames.push(name)
      })
    } else {
      // For 'any', check both movie and TV genres
      genreIds.forEach((id: number) => {
        const movieName = movieGenres[id]
        const tvName = tvGenres[id]
        if (movieName) selectedGenreNames.push(movieName)
        if (tvName && tvName !== movieName) selectedGenreNames.push(tvName)
      })
    }
  }

  // For "me" mode, we need all preferences to show who has seen items
  // For room mode, we'll fetch all preferences later if needed
  let preferencesWhere: any = undefined
  if (mode === 'me') {
    // Get all room members to fetch all preferences
    const allRoomMembers = await prisma.roomMembership.findMany({
      where: { roomId: { in: targetRoomIds } },
      select: { userId: true },
    })
    const allMemberIds = Array.from(new Set(allRoomMembers.map((m) => m.userId)))
    preferencesWhere = { userId: { in: allMemberIds } }
  } else {
    preferencesWhere = { userId: { in: memberIds } }
  }

  const mediaItems = await prisma.mediaItem.findMany({
    where,
    include: {
      preferences: {
        where: preferencesWhere,
      },
      createdBy: {
        select: { name: true },
      },
    },
  })

  // Filter by genres if specified (check if any selected genre name is in the item's genres array)
  let filteredItems = mediaItems
  if (selectedGenreNames.length > 0) {
    filteredItems = mediaItems.filter((item) => {
      try {
        const itemGenres = item.genres ? JSON.parse(item.genres) : []
        // Check if any of the selected genre names match any genre in the item
        // itemGenres is an array of genre names (strings)
        return itemGenres.some((itemGenre: string) => selectedGenreNames.includes(itemGenre))
      } catch {
        return false
      }
    })
  }

  if (mode === 'me') {
    // Just me mode: filter by my preferences
    const myItems = filteredItems.filter((item) => {
      const myPref = item.preferences.find((p) => p.userId === session.user.id)
      return (
        myPref &&
        myPref.status === 'HAVE_NOT_SEEN'
      )
    })

    // Sort by my excitement, then rating, then recency (lightweight), then recently added
    myItems.sort((a, b) => {
      const aPref = a.preferences.find((p) => p.userId === session.user.id)
      const bPref = b.preferences.find((p) => p.userId === session.user.id)
      const aExc = aPref?.excitement || 0
      const bExc = bPref?.excitement || 0
      if (bExc !== aExc) return bExc - aExc
      // If excitement is equal, prioritize higher rated items
      const aRating = a.rating || 0
      const bRating = b.rating || 0
      if (Math.abs(bRating - aRating) > 0.5) {
        // If ratings differ significantly, use rating
        return bRating - aRating
      }
      // If ratings are close, use recency as lightweight influence
      const aRecency = getRecencyScore(a.createdAt)
      const bRecency = getRecencyScore(b.createdAt)
      if (bRecency !== aRecency) return bRecency - aRecency
      // Final tiebreaker: exact creation time
      return b.createdAt.getTime() - a.createdAt.getTime()
    })

    // Get user data for interested and seen users
    const allUserIds = new Set<string>()
    myItems.forEach((item) => {
      item.preferences.forEach((p) => {
        allUserIds.add(p.userId)
      })
    })
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) } },
      select: { id: true, name: true, imageUrl: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    const results = myItems
      .map((item) => {
        const myPref = item.preferences.find((p) => p.userId === session.user.id)
        const genres = item.genres ? JSON.parse(item.genres) : []
        const interested = item.preferences.filter((p) => p.status === 'HAVE_NOT_SEEN')
        const seenUsers = item.preferences
          .filter((p) => p.status === 'ALREADY_SEEN')
          .map((p) => {
            const user = userMap.get(p.userId)
            return user ? { id: user.id, name: user.name, imageUrl: user.imageUrl } : null
          })
          .filter((u): u is NonNullable<typeof u> => u !== null)
        
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
          genres,
          runtimeMinutes: item.runtimeMinutes,
          rating: item.rating,
          releaseDate: item.releaseDate,
          myExcitement: myPref?.excitement || 0,
          myStatus: myPref?.status.toLowerCase() || null,
          interestedCount: interested.length,
          avgExcitement: Math.round(avgExcitement * 10) / 10,
          interestedUsers: interested.map((p) => {
            const user = userMap.get(p.userId)
            return user ? { id: user.id, name: user.name, imageUrl: user.imageUrl } : { id: p.userId, name: 'Unknown', imageUrl: null }
          }),
          seenUsers,
        }
      })
      .filter((item) => {
        // If showSeenAndNoExcitement is true, only show items where:
        // - Other people have seen it (seenUsers.length > 0)
        // - No one else is excited (interestedCount === 1, meaning only the current user)
        if (showSeenAndNoExcitement) {
          return item.seenUsers.length > 0 && item.interestedCount === 1
        }
        // Otherwise, show all items (no additional filtering)
        return true
      })

    return NextResponse.json({ recommendations: results })
  } else {
    // Room/All mode: aggregate interest
    // For "all-rooms" or "Just My Stuff", we need to get all members from all rooms
    if (roomId === 'all-rooms' || isJustMyStuff) {
      const allRoomMembers = await prisma.roomMembership.findMany({
        where: { roomId: { in: targetRoomIds } },
        select: { userId: true },
      })
      const allMemberIds = Array.from(new Set(allRoomMembers.map((m) => m.userId)))
      
      // For "Just My Stuff", we want preferences from all users on the user's items
      // For "all-rooms", we want preferences from all members
      
      // Re-fetch preferences with all members
      const mediaItemsWithAllPrefs = await prisma.mediaItem.findMany({
        where,
        include: {
          preferences: {
            where: {
              userId: { in: allMemberIds },
            },
          },
          createdBy: {
            select: { name: true },
          },
        },
      })

      // Apply genre filter if specified
      let filteredItemsWithPrefs = mediaItemsWithAllPrefs
      if (selectedGenreNames.length > 0) {
        filteredItemsWithPrefs = mediaItemsWithAllPrefs.filter((item) => {
          try {
            const itemGenres = item.genres ? JSON.parse(item.genres) : []
            return itemGenres.some((itemGenre: string) => selectedGenreNames.includes(itemGenre))
          } catch {
            return false
          }
        })
      }

      const roomItems = filteredItemsWithPrefs
        .map((item) => {
          const interested = item.preferences.filter(
            (p) => p.status === 'HAVE_NOT_SEEN'
          )

          if (interested.length === 0) return null

          const totalExcitement = interested.reduce((sum, p) => sum + p.excitement, 0)
          const avgExcitement = totalExcitement / interested.length

          return {
            item,
            interestedCount: interested.length,
            avgExcitement,
            interested,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)

      // Sort by interestedCount, then avgExcitement, then rating, then recency (lightweight), then recently added
      roomItems.sort((a, b) => {
        if (b.interestedCount !== a.interestedCount) {
          return b.interestedCount - a.interestedCount
        }
        if (b.avgExcitement !== a.avgExcitement) {
          return b.avgExcitement - a.avgExcitement
        }
        // If excitement is equal, prioritize higher rated items
        const aRating = a.item.rating || 0
        const bRating = b.item.rating || 0
        if (Math.abs(bRating - aRating) > 0.5) {
          // If ratings differ significantly, use rating
          return bRating - aRating
        }
        // If ratings are close, use recency as lightweight influence
        const aRecency = getRecencyScore(a.item.createdAt)
        const bRecency = getRecencyScore(b.item.createdAt)
        if (bRecency !== aRecency) return bRecency - aRecency
        // Final tiebreaker: exact creation time
        return b.item.createdAt.getTime() - a.item.createdAt.getTime()
      })

      // Get user data for interested and seen users
      const allUserIds = new Set<string>()
      roomItems.forEach(({ item }) => {
        item.preferences.forEach((p) => {
          allUserIds.add(p.userId)
        })
      })
      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(allUserIds) } },
        select: { id: true, name: true, imageUrl: true },
      })
      const userMap = new Map(users.map((u) => [u.id, u]))

      const results = roomItems.map(({ item, interestedCount, avgExcitement, interested }) => {
        const genres = item.genres ? JSON.parse(item.genres) : []
        const myPref = item.preferences.find((p) => p.userId === session.user.id)
        const seenUsers = item.preferences
          .filter((p) => p.status === 'ALREADY_SEEN')
          .map((p) => {
            const user = userMap.get(p.userId)
            return user ? { id: user.id, name: user.name, imageUrl: user.imageUrl } : null
          })
          .filter((u): u is NonNullable<typeof u> => u !== null)

        return {
          id: item.id,
          title: item.title,
          type: item.type.toLowerCase(),
          tmdbId: item.tmdbId,
          sourceType: item.sourceType?.toLowerCase(),
          posterUrl: item.posterUrl,
          description: item.description,
          genres,
          runtimeMinutes: item.runtimeMinutes,
          rating: item.rating,
          releaseDate: item.releaseDate,
          myExcitement: myPref?.excitement || null,
          myStatus: myPref?.status.toLowerCase() || null,
          interestedCount,
          avgExcitement: Math.round(avgExcitement * 10) / 10,
          interestedUsers: interested.map((p) => {
            const user = userMap.get(p.userId)
            return user ? { id: user.id, name: user.name, imageUrl: user.imageUrl } : { id: p.userId, name: 'Unknown', imageUrl: null }
          }),
          seenUsers,
        }
      })

      return NextResponse.json({ recommendations: results })
    } else {
      // Single room mode
      const roomItems = filteredItems
        .map((item) => {
          const interested = item.preferences.filter(
            (p) => p.status === 'HAVE_NOT_SEEN'
          )

          if (interested.length === 0) return null

          const totalExcitement = interested.reduce((sum, p) => sum + p.excitement, 0)
          const avgExcitement = totalExcitement / interested.length

          return {
            item,
            interestedCount: interested.length,
            avgExcitement,
            interested,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)

      // Sort by interestedCount, then avgExcitement, then rating, then recency (lightweight), then recently added
      roomItems.sort((a, b) => {
        if (b.interestedCount !== a.interestedCount) {
          return b.interestedCount - a.interestedCount
        }
        if (b.avgExcitement !== a.avgExcitement) {
          return b.avgExcitement - a.avgExcitement
        }
        // If excitement is equal, prioritize higher rated items
        const aRating = a.item.rating || 0
        const bRating = b.item.rating || 0
        if (Math.abs(bRating - aRating) > 0.5) {
          // If ratings differ significantly, use rating
          return bRating - aRating
        }
        // If ratings are close, use recency as lightweight influence
        const aRecency = getRecencyScore(a.item.createdAt)
        const bRecency = getRecencyScore(b.item.createdAt)
        if (bRecency !== aRecency) return bRecency - aRecency
        // Final tiebreaker: exact creation time
        return b.item.createdAt.getTime() - a.item.createdAt.getTime()
      })

      // Get user data for interested and seen users
      const allUserIds = new Set<string>()
      roomItems.forEach(({ item }) => {
        item.preferences.forEach((p) => {
          allUserIds.add(p.userId)
        })
      })
      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(allUserIds) } },
        select: { id: true, name: true, imageUrl: true },
      })
      const userMap = new Map(users.map((u) => [u.id, u]))

      const results = roomItems.map(({ item, interestedCount, avgExcitement, interested }) => {
        const genres = item.genres ? JSON.parse(item.genres) : []
        const myPref = item.preferences.find((p) => p.userId === session.user.id)
        const seenUsers = item.preferences
          .filter((p) => p.status === 'ALREADY_SEEN')
          .map((p) => {
            const user = userMap.get(p.userId)
            return user ? { id: user.id, name: user.name, imageUrl: user.imageUrl } : null
          })
          .filter((u): u is NonNullable<typeof u> => u !== null)

        return {
          id: item.id,
          title: item.title,
          type: item.type.toLowerCase(),
          tmdbId: item.tmdbId,
          sourceType: item.sourceType?.toLowerCase(),
          posterUrl: item.posterUrl,
          description: item.description,
          genres,
          runtimeMinutes: item.runtimeMinutes,
          rating: item.rating,
          releaseDate: item.releaseDate,
          myExcitement: myPref?.excitement || null,
          myStatus: myPref?.status.toLowerCase() || null,
          interestedCount,
          avgExcitement: Math.round(avgExcitement * 10) / 10,
          interestedUsers: interested.map((p) => {
            const user = userMap.get(p.userId)
            return user ? { id: user.id, name: user.name, imageUrl: user.imageUrl } : { id: p.userId, name: 'Unknown', imageUrl: null }
          }),
          seenUsers,
        }
      })

      return NextResponse.json({ recommendations: results })
    }
  }
}
