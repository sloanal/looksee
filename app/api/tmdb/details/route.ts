import { NextRequest, NextResponse } from 'next/server'

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

// GET /api/tmdb/details?id=...&type=movie|tv
export async function GET(request: NextRequest) {
  if (!TMDB_API_KEY) {
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
    const response = await fetch(
      `${TMDB_BASE_URL}/${endpoint}/${id}?api_key=${TMDB_API_KEY}`
    )
    const data = await response.json()

    if (data.status_code || data.status_message) {
      return NextResponse.json({ error: 'TMDB item not found' }, { status: 404 })
    }

    const genres = data.genres?.map((g: any) => g.name) || []
    const runtime = type === 'movie' ? data.runtime : data.episode_run_time?.[0] || null

    return NextResponse.json({
      id: data.id,
      title: type === 'movie' ? data.title : data.name,
      type: type === 'movie' ? 'movie' : 'show',
      overview: data.overview,
      posterPath: data.poster_path,
      posterUrl: data.poster_path ? `${TMDB_IMAGE_BASE}${data.poster_path}` : null,
      genres,
      runtimeMinutes: runtime,
      releaseDate: type === 'movie' ? data.release_date : data.first_air_date,
    })
  } catch (error) {
    console.error('TMDB details error:', error)
    return NextResponse.json({ error: 'Failed to fetch TMDB details' }, { status: 500 })
  }
}

