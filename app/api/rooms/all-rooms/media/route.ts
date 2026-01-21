import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/rooms/all-rooms/media - Create a media item and add it to all rooms the user is a member of
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

    // Get all rooms the user is a member of
    const memberships = await prisma.roomMembership.findMany({
      where: { userId: session.user.id },
      select: { roomId: true },
    })

    if (memberships.length === 0) {
      return NextResponse.json({ error: 'You must be a member of at least one room' }, { status: 400 })
    }

    const roomIds = memberships.map((m) => m.roomId)

    // Get user's first room for the required roomId field (backward compatibility)
    const firstRoomId = roomIds[0]

    // Check if item already exists (by tmdbId if provided)
    let mediaItem = null
    if (tmdbId) {
      const tmdbIdString = String(tmdbId)
      const existingItem = await prisma.mediaItem.findFirst({
        where: { tmdbId: tmdbIdString },
      })
      mediaItem = existingItem
    }

    // Create or use existing media item
    if (!mediaItem) {
      mediaItem = await prisma.mediaItem.create({
        data: {
          roomId: firstRoomId, // Required for backward compatibility
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

    // Add the item to all rooms the user is a member of
    // Use createMany with skipDuplicates to handle cases where item might already be in some rooms
    const mediaItemRoomData = roomIds.map((roomId) => ({
      mediaItemId: mediaItem.id,
      roomId,
      addedByUserId: session.user.id,
    }))

    // Check which rooms the item is already in
    const existingRooms = await prisma.mediaItemRoom.findMany({
      where: {
        mediaItemId: mediaItem.id,
        roomId: { in: roomIds },
      },
      select: { roomId: true },
    })

    const existingRoomIds = new Set(existingRooms.map((er) => er.roomId))
    const roomsToAdd = mediaItemRoomData.filter((data) => !existingRoomIds.has(data.roomId))

    if (roomsToAdd.length > 0) {
      await prisma.mediaItemRoom.createMany({
        data: roomsToAdd,
        skipDuplicates: true,
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
    console.error('Error creating media item for all rooms:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create media item' },
      { status: 500 }
    )
  }
}
