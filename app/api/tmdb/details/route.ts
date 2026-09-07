import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isTmdbConfigured, TMDB_IMAGE_BASE, tmdbFetch } from '@/lib/tmdb-client'

// GET /api/tmdb/details?id=...&type=movie|tv
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isTmdbConfigured()) {
    console.error('[TMDB Details] API key not configured')
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
    const response = await tmdbFetch(`/${endpoint}/${id}`)
    const data = await response.json()

    if (data.status_code || data.status_message) {
      return NextResponse.json({ error: 'TMDB item not found' }, { status: 404 })
    }

    const genres = data.genres?.map((g: any) => g.name) || []
    const runtime = type === 'movie' ? data.runtime : data.episode_run_time?.[0] || null
    const rating = data.vote_average || null
    const releaseDate = type === 'movie' ? data.release_date : data.first_air_date

    return NextResponse.json({
      id: data.id,
      title: type === 'movie' ? data.title : data.name,
      type: type === 'movie' ? 'movie' : 'show',
      overview: data.overview,
      posterPath: data.poster_path,
      posterUrl: data.poster_path ? `${TMDB_IMAGE_BASE}${data.poster_path}` : null,
      genres,
      runtimeMinutes: runtime,
      rating,
      releaseDate: releaseDate || null,
    })
  } catch (error) {
    console.error('TMDB details error:', error)
    return NextResponse.json({ error: 'Failed to fetch TMDB details' }, { status: 500 })
  }
}
