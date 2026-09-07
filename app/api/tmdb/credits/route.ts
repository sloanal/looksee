import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isTmdbConfigured, tmdbFetch } from '@/lib/tmdb-client'

// Enough to cover a title card's top-billed cast without overwhelming the overlay.
const TOP_CAST_LIMIT = 5

interface TmdbCastMember {
  name?: string
  order?: number
}

interface TmdbCrewMember {
  name?: string
  job?: string
}

// GET /api/tmdb/credits?id=...&type=movie|tv
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isTmdbConfigured()) {
    console.error('[TMDB Credits] API key not configured')
    return NextResponse.json({ error: 'TMDB API key not configured' }, { status: 500 })
  }

  const searchParams = request.nextUrl.searchParams
  const id = searchParams.get('id')
  const type = searchParams.get('type')

  if (!id || !type) {
    return NextResponse.json({ error: 'ID and type parameters are required' }, { status: 400 })
  }

  try {
    const endpoint = type === 'movie' ? 'movie' : 'tv'
    const response = await tmdbFetch(`/${endpoint}/${id}`, { append_to_response: 'credits' })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch credits' }, { status: response.status })
    }

    const data = await response.json()

    if (data.status_code || data.status_message) {
      return NextResponse.json({ error: 'Credits not found' }, { status: 404 })
    }

    const cast: TmdbCastMember[] = data.credits?.cast || []
    const crew: TmdbCrewMember[] = data.credits?.crew || []

    // Shows are credited to their creators rather than a per-episode director;
    // crew directors are kept as a fallback for the rare show missing one.
    const creators: string[] = endpoint === 'tv'
      ? (data.created_by || []).map((creator: { name?: string }) => creator.name).filter(Boolean)
      : []
    const crewDirectors = crew
      .filter((member) => member.job === 'Director')
      .map((member) => member.name)
      .filter(Boolean) as string[]
    const director = Array.from(new Set(creators.length > 0 ? creators : crewDirectors))

    const topCast = [...cast]
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
      .slice(0, TOP_CAST_LIMIT)
      .map((member) => member.name)
      .filter(Boolean) as string[]

    return NextResponse.json({ director, cast: topCast })
  } catch (error) {
    console.error('TMDB credits error:', error)
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 })
  }
}
