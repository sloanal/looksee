import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { userCanAccessMediaItem } from '@/lib/visibility'

// POST /api/media/[mediaItemId]/favorite - Toggle the viewer's favorite flag on a title.
// Creates a default (unseen, neutral) preference when the viewer has none; otherwise
// only isFavorite changes — status, excitement and isWatched are never touched.
// ratedAt is deliberately left null on create and untouched on update, so a
// favorite-only row still counts as unrated for the New queue.
export async function POST(
  request: NextRequest,
  { params }: { params: { mediaItemId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const isFavorite = body?.isFavorite
  if (typeof isFavorite !== 'boolean') {
    return NextResponse.json({ error: 'isFavorite must be a boolean' }, { status: 400 })
  }

  const { mediaItemId } = params
  if (!(await userCanAccessMediaItem(session.user.id, mediaItemId))) {
    return NextResponse.json({ error: 'Media item not found' }, { status: 404 })
  }

  const preference = await prisma.userMediaPreference.upsert({
    where: {
      userId_mediaItemId: {
        userId: session.user.id,
        mediaItemId,
      },
    },
    create: {
      userId: session.user.id,
      mediaItemId,
      status: 'HAVE_NOT_SEEN',
      isWatched: false,
      excitement: 3,
      isFavorite,
    },
    update: {
      isFavorite,
    },
    select: { isFavorite: true },
  })

  return NextResponse.json({ isFavorite: preference.isFavorite })
}
