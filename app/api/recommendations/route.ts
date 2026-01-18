import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/recommendations - Get watch recommendations for "Just My Stuff", "All Rooms", or a specific room
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const roomId = searchParams.get('roomId')
  const body = await request.json()

  const { mode, typePreference, genres } = body

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

  if (roomId === 'all-rooms') {
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

  // Filter by genres
  if (genres && genres.length > 0) {
    where.genres = {
      contains: JSON.stringify(genres[0]), // Simple contains check
    }
  }

  const mediaItems = await prisma.mediaItem.findMany({
    where,
    include: {
      preferences: {
        where: {
          userId: { in: memberIds },
        },
      },
      createdBy: {
        select: { name: true },
      },
    },
  })

  if (mode === 'me') {
    // Just me mode: filter by my preferences
    const myItems = mediaItems.filter((item) => {
      const myPref = item.preferences.find((p) => p.userId === session.user.id)
      return (
        myPref &&
        (myPref.status === 'NOT_SEEN_WANT' || myPref.status === 'SEEN_WOULD_REWATCH')
      )
    })

    // Sort by my excitement, then recently added
    myItems.sort((a, b) => {
      const aPref = a.preferences.find((p) => p.userId === session.user.id)
      const bPref = b.preferences.find((p) => p.userId === session.user.id)
      const aExc = aPref?.excitement || 0
      const bExc = bPref?.excitement || 0
      if (bExc !== aExc) return bExc - aExc
      return b.createdAt.getTime() - a.createdAt.getTime()
    })

    const results = myItems.map((item) => {
      const myPref = item.preferences.find((p) => p.userId === session.user.id)
      const genres = item.genres ? JSON.parse(item.genres) : []
      return {
        id: item.id,
        title: item.title,
        type: item.type.toLowerCase(),
        posterUrl: item.posterUrl,
        description: item.description,
        genres,
        runtimeMinutes: item.runtimeMinutes,
        releaseDate: item.releaseDate,
        myExcitement: myPref?.excitement || 0,
        myStatus: myPref?.status.toLowerCase() || null,
        interestedCount: 1,
        avgExcitement: myPref?.excitement || 0,
        interestedUsers: [{ id: session.user.id, name: session.user.name }],
      }
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

      const roomItems = mediaItemsWithAllPrefs
        .map((item) => {
          const interested = item.preferences.filter(
            (p) => p.status === 'NOT_SEEN_WANT' || p.status === 'SEEN_WOULD_REWATCH'
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

      // Sort by interestedCount, then avgExcitement, then recently added
      roomItems.sort((a, b) => {
        if (b.interestedCount !== a.interestedCount) {
          return b.interestedCount - a.interestedCount
        }
        if (b.avgExcitement !== a.avgExcitement) {
          return b.avgExcitement - a.avgExcitement
        }
        return b.item.createdAt.getTime() - a.item.createdAt.getTime()
      })

      // Get user names for interested users
      const userIds = new Set(roomItems.flatMap((r) => r.interested.map((p) => p.userId)))
      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(userIds) } },
        select: { id: true, name: true },
      })
      const userMap = new Map(users.map((u) => [u.id, u.name]))

      const results = roomItems.map(({ item, interestedCount, avgExcitement, interested }) => {
        const genres = item.genres ? JSON.parse(item.genres) : []
        const myPref = item.preferences.find((p) => p.userId === session.user.id)

        return {
          id: item.id,
          title: item.title,
          type: item.type.toLowerCase(),
          posterUrl: item.posterUrl,
          description: item.description,
          genres,
          runtimeMinutes: item.runtimeMinutes,
          releaseDate: item.releaseDate,
          myExcitement: myPref?.excitement || null,
          myStatus: myPref?.status.toLowerCase() || null,
          interestedCount,
          avgExcitement: Math.round(avgExcitement * 10) / 10,
          interestedUsers: interested.map((p) => ({
            id: p.userId,
            name: userMap.get(p.userId) || 'Unknown',
          })),
        }
      })

      return NextResponse.json({ recommendations: results })
    } else {
      // Single room mode
      const roomItems = mediaItems
        .map((item) => {
          const interested = item.preferences.filter(
            (p) => p.status === 'NOT_SEEN_WANT' || p.status === 'SEEN_WOULD_REWATCH'
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

      // Sort by interestedCount, then avgExcitement, then recently added
      roomItems.sort((a, b) => {
        if (b.interestedCount !== a.interestedCount) {
          return b.interestedCount - a.interestedCount
        }
        if (b.avgExcitement !== a.avgExcitement) {
          return b.avgExcitement - a.avgExcitement
        }
        return b.item.createdAt.getTime() - a.item.createdAt.getTime()
      })

      // Get user names for interested users
      const userIds = new Set(roomItems.flatMap((r) => r.interested.map((p) => p.userId)))
      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(userIds) } },
        select: { id: true, name: true },
      })
      const userMap = new Map(users.map((u) => [u.id, u.name]))

      const results = roomItems.map(({ item, interestedCount, avgExcitement, interested }) => {
        const genres = item.genres ? JSON.parse(item.genres) : []
        const myPref = item.preferences.find((p) => p.userId === session.user.id)

        return {
          id: item.id,
          title: item.title,
          type: item.type.toLowerCase(),
          posterUrl: item.posterUrl,
          description: item.description,
          genres,
          runtimeMinutes: item.runtimeMinutes,
          releaseDate: item.releaseDate,
          myExcitement: myPref?.excitement || null,
          myStatus: myPref?.status.toLowerCase() || null,
          interestedCount,
          avgExcitement: Math.round(avgExcitement * 10) / 10,
          interestedUsers: interested.map((p) => ({
            id: p.userId,
            name: userMap.get(p.userId) || 'Unknown',
          })),
        }
      })

      return NextResponse.json({ recommendations: results })
    }
  }
}
