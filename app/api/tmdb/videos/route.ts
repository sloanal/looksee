import { NextRequest, NextResponse } from 'next/server'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

const getEnvVars = () => ({
  TMDB_API_KEY: process.env.TMDB_API_KEY,
  TMDB_READ_ACCESS_TOKEN: process.env.TMDB_API_READ_ACCESS_TOKEN,
})

const normalizeToken = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.toLowerCase().startsWith('bearer ')) {
    return trimmed.slice(7).trim()
  }
  return trimmed
}

const isBearerToken = (value?: string | null) => {
  const normalized = normalizeToken(value)
  if (!normalized) return false
  const segments = normalized.split('.')
  return segments.length === 3 && segments.every(Boolean)
}

const shouldTreatAsBearer = (value: string) => {
  if (isBearerToken(value)) return true
  return value.length > 40
}

const getTmdbAuth = () => {
  const { TMDB_API_KEY, TMDB_READ_ACCESS_TOKEN } = getEnvVars()
  const readAccessToken = normalizeToken(TMDB_READ_ACCESS_TOKEN)
  if (readAccessToken) {
    return { type: 'bearer' as const, value: readAccessToken }
  }
  const apiKey = normalizeToken(TMDB_API_KEY)
  if (apiKey) {
    if (shouldTreatAsBearer(apiKey)) {
      return { type: 'bearer' as const, value: apiKey }
    }
    return { type: 'apiKey' as const, value: apiKey }
  }
  return { type: 'none' as const, value: '' }
}

const extractApiKeyFromToken = (token: string): string | null => {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    const decoded = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
    const parsed = JSON.parse(decoded)
    return parsed.aud || null
  } catch (error) {
    console.error('[TMDB Videos] Failed to extract API key from token:', error)
    return null
  }
}

const getFallbackApiKey = () => {
  const { TMDB_API_KEY, TMDB_READ_ACCESS_TOKEN } = getEnvVars()
  const apiKey = normalizeToken(TMDB_API_KEY)
  if (apiKey && !shouldTreatAsBearer(apiKey)) {
    return apiKey
  }
  const readAccessToken = normalizeToken(TMDB_READ_ACCESS_TOKEN)
  if (readAccessToken && isBearerToken(readAccessToken)) {
    const extractedKey = extractApiKeyFromToken(readAccessToken)
    if (extractedKey) {
      return extractedKey
    }
  }
  return null
}

// GET /api/tmdb/videos?id=...&type=movie|tv
export async function GET(request: NextRequest) {
  const auth = getTmdbAuth()
  const fallbackApiKey = auth.type === 'bearer' ? getFallbackApiKey() : null

  if (auth.type === 'none') {
    console.error('[TMDB Videos] API key not configured. TMDB_API_KEY:', !!process.env.TMDB_API_KEY, 'TMDB_READ_ACCESS_TOKEN:', !!process.env.TMDB_API_READ_ACCESS_TOKEN)
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
    const videosUrl = new URL(`${TMDB_BASE_URL}/${endpoint}/${id}/videos`)
    if (auth.type === 'apiKey') {
      videosUrl.searchParams.set('api_key', auth.value)
    }

    const headers: HeadersInit = auth.type === 'bearer' 
      ? { 
          'Authorization': `Bearer ${auth.value}`,
          'accept': 'application/json'
        }
      : { 'accept': 'application/json' }
    
    let response = await fetch(videosUrl.toString(), { headers })
    
    if (auth.type === 'bearer' && fallbackApiKey && response.status === 401) {
      const retryUrl = new URL(videosUrl.toString())
      retryUrl.searchParams.set('api_key', fallbackApiKey)
      response = await fetch(retryUrl.toString(), {
        headers: { 'accept': 'application/json' }
      })
    }

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
      trailer: trailer ? {
        key: trailer.key,
        name: trailer.name,
        site: trailer.site,
        official: trailer.official,
        url: `https://www.youtube.com/embed/${trailer.key}`
      } : null,
      allVideos: data.results || []
    })
  } catch (error) {
    console.error('TMDB videos error:', error)
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
  }
}
