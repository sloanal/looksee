import { NextRequest, NextResponse } from 'next/server'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

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
  // v3 API keys are 32 chars; longer values are likely v4 tokens.
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
    // JWT format: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    // Decode payload (base64url)
    const payload = parts[1]
    const decoded = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
    const parsed = JSON.parse(decoded)
    
    // The 'aud' field contains the API key
    return parsed.aud || null
  } catch (error) {
    console.error('[TMDB Details] Failed to extract API key from token:', error)
    return null
  }
}

const getFallbackApiKey = () => {
  const { TMDB_API_KEY, TMDB_READ_ACCESS_TOKEN } = getEnvVars()
  // First try explicit API key
  const apiKey = normalizeToken(TMDB_API_KEY)
  if (apiKey && !shouldTreatAsBearer(apiKey)) {
    return apiKey
  }
  
  // If we have a bearer token, try extracting API key from it
  const readAccessToken = normalizeToken(TMDB_READ_ACCESS_TOKEN)
  if (readAccessToken && isBearerToken(readAccessToken)) {
    const extractedKey = extractApiKeyFromToken(readAccessToken)
    if (extractedKey) {
      console.log('[TMDB Details] Extracted API key from token')
      return extractedKey
    }
  }
  
  return null
}

// GET /api/tmdb/details?id=...&type=movie|tv
export async function GET(request: NextRequest) {
  const auth = getTmdbAuth()
  const fallbackApiKey = auth.type === 'bearer' ? getFallbackApiKey() : null

  if (auth.type === 'none') {
    console.error('[TMDB Details] API key not configured. TMDB_API_KEY:', !!process.env.TMDB_API_KEY, 'TMDB_READ_ACCESS_TOKEN:', !!process.env.TMDB_API_READ_ACCESS_TOKEN)
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
    const detailsUrl = new URL(`${TMDB_BASE_URL}/${endpoint}/${id}`)
    if (auth.type === 'apiKey') {
      detailsUrl.searchParams.set('api_key', auth.value)
    }
    
    // For v4 bearer tokens, need accept header
    const headers: HeadersInit = auth.type === 'bearer' 
      ? { 
          'Authorization': `Bearer ${auth.value}`,
          'accept': 'application/json'
        }
      : { 'accept': 'application/json' }
    
    let response = await fetch(detailsUrl.toString(), { headers })
    
    if (auth.type === 'bearer' && fallbackApiKey && response.status === 401) {
      const retryUrl = new URL(detailsUrl.toString())
      retryUrl.searchParams.set('api_key', fallbackApiKey)
      console.log('[TMDB Details] Bearer auth failed; retrying with api_key:', fallbackApiKey.substring(0, 8) + '...')
      response = await fetch(retryUrl.toString(), {
        headers: { 'accept': 'application/json' }
      })
      console.log('[TMDB Details] Fallback response status:', response.status)
    }
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

