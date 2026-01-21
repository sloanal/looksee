import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/rooms/[roomId]/members - Get all members of a room
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { roomId } = params

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

  // Get all members of the room
  const memberships = await prisma.roomMembership.findMany({
    where: { roomId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Deduplicate members by userId and email (in case of duplicate memberships or duplicate users)
  // Keep the first membership for each user (by creation date)
  const seenUserIds = new Set<string>()
  const seenEmails = new Set<string>()
  const members = memberships
    .map((m) => ({
      id: m.user.id,
      name: m.user.name,
      imageUrl: m.user.imageUrl,
      email: m.user.email,
      role: m.role,
    }))
    .filter((member) => {
      // Deduplicate by userId first (most common case: duplicate memberships)
      if (seenUserIds.has(member.id)) {
        return false
      }
      // Also deduplicate by email as a fallback (in case of duplicate User records)
      if (seenEmails.has(member.email.toLowerCase())) {
        return false
      }
      seenUserIds.add(member.id)
      seenEmails.add(member.email.toLowerCase())
      return true
    })

  return NextResponse.json({ members })
}
