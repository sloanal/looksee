import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isTmdbConfigured, tmdbFetch } from '@/lib/tmdb-client'

// GET /api/tmdb/videos?id=...&type=movie|tv
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isTmdbConfigured()) {
    console.error('[TMDB Videos] API key not configured')
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
    const response = await tmdbFetch(`/${endpoint}/${id}/videos`)

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch videos' }, { status: response.status })
    }

    const data = await response.json()

    if (data.status_code || data.status_message) {
      return NextResponse.json({ error: 'Videos not found' }, { status: 404 })
    }

    // Filter for trailers, prefer official ones
    const trailers = (data.results || [])
      .filter((video: any) =>
        video.type === 'Trailer' &&
        video.site === 'YouTube' &&
        video.key
      )
      .sort((a: any, b: any) => {
        // Prefer official trailers
        if (a.official && !b.official) return -1
        if (!a.official && b.official) return 1
        return 0
      })

    const trailer = trailers.length > 0 ? trailers[0] : null

    return NextResponse.json({
      trailer: trailer
        ? {
          key: trailer.key,
          name: trailer.name,
          site: trailer.site,
          official: trailer.official,
          url: `https://www.youtube.com/embed/${trailer.key}`,
        }
        : null,
      allVideos: data.results || [],
    })
  } catch (error) {
    console.error('TMDB videos error:', error)
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
  }
}
