import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildRecommendations } from '@/lib/recommendations'

// POST /api/recommendations - Get watch recommendations for "Just My Stuff", "All Rooms", or a specific room
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const roomId = request.nextUrl.searchParams.get('roomId')
  const body = await request.json()
  const { mode, typePreference, genres, showSeenAndNoExcitement } = body

  const outcome = await buildRecommendations({
    viewerUserId: session.user.id,
    roomId,
    mode: mode === 'me' ? 'me' : 'room',
    typePreference,
    genres,
    showSeenAndNoExcitement: showSeenAndNoExcitement === true,
  })

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status })
  }
  return NextResponse.json({ recommendations: outcome.recommendations })
}
