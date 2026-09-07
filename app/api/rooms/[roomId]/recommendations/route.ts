import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildRecommendations } from '@/lib/recommendations'

// POST /api/rooms/[roomId]/recommendations - Watch recommendations scoped to one room.
// Legacy path: the app calls POST /api/recommendations?roomId=… instead. Kept
// as a thin alias so both return the same shape.
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { mode, typePreference, genres, showSeenAndNoExcitement } = body

  const outcome = await buildRecommendations({
    viewerUserId: session.user.id,
    roomId: params.roomId,
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
