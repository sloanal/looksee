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
    console.error('[TMDB Search] Failed to extract API key from token:', error)
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
      console.log('[TMDB Search] Extracted API key from token')
      return extractedKey
    }
  }
  
  return null
}

// GET /api/tmdb/search?query=...&type=movie|tv|mixed
export async function GET(request: NextRequest) {
  const auth = getTmdbAuth()
  const fallbackApiKey = auth.type === 'bearer' ? getFallbackApiKey() : null

  // Enhanced logging for debugging
  const envVars = getEnvVars()
  console.log('[TMDB Search] Auth check:', {
    authType: auth.type,
    hasApiKey: !!envVars.TMDB_API_KEY,
    hasReadToken: !!envVars.TMDB_READ_ACCESS_TOKEN,
    apiKeyLength: envVars.TMDB_API_KEY?.length || 0,
    readTokenLength: envVars.TMDB_READ_ACCESS_TOKEN?.length || 0,
    hasFallback: !!fallbackApiKey,
  })

  if (auth.type === 'none') {
    console.error('[TMDB Search] API key not configured. TMDB_API_KEY:', !!process.env.TMDB_API_KEY, 'TMDB_READ_ACCESS_TOKEN:', !!process.env.TMDB_API_READ_ACCESS_TOKEN)
    return NextResponse.json({ error: 'TMDB API key not configured' }, { status: 500 })
  }

  if (auth.type === 'apiKey' && auth.value.length < 10) {
    console.error(
      '[TMDB Search] API key appears invalid (too short):',
      auth.value.substring(0, 5) + '...'
    )
    return NextResponse.json({ error: 'TMDB API key appears invalid' }, { status: 500 })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query')
  const type = searchParams.get('type') || 'mixed'

  console.log('[TMDB Search] Request:', {
    query,
    type,
    authType: auth.type,
    authValuePrefix: auth.value.substring(0, 8) + '...',
  })

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
  }

  try {
    const fetchFromTmdb = async (url: URL) => {
      // For v4 bearer tokens, need accept header
      // For API key auth, also include accept header
      const headers: HeadersInit = auth.type === 'bearer' 
        ? { 
            'Authorization': `Bearer ${auth.value}`,
            'accept': 'application/json'
          }
        : { 'accept': 'application/json' }
      
      console.log('[TMDB Search] Fetching from TMDB:', {
        url: url.toString().replace(auth.value, '***').replace(fallbackApiKey || '', '***'),
        method: 'GET',
        headers: Object.keys(headers),
        authType: auth.type,
      })
      
      const response = await fetch(url.toString(), { headers })
      const text = await response.text()

      console.log('[TMDB Search] Initial response:', {
        status: response.status,
        statusText: response.statusText,
        bodyPreview: text.substring(0, 200),
      })

      if (auth.type === 'bearer' && fallbackApiKey && response.status === 401) {
        const retryUrl = new URL(url.toString())
        retryUrl.searchParams.set('api_key', fallbackApiKey)
        console.log('[TMDB Search] Bearer auth failed (401); retrying with api_key fallback:', fallbackApiKey.substring(0, 8) + '...')
        const retryResponse = await fetch(retryUrl.toString(), {
          headers: { 'accept': 'application/json' }
        })
        const retryText = await retryResponse.text()
        console.log('[TMDB Search] Fallback response status:', retryResponse.status)
        if (!retryResponse.ok) {
          console.log('[TMDB Search] Fallback response body:', retryText.substring(0, 200))
        }
        return { response: retryResponse, text: retryText, usedFallback: true }
      }

      // If API key auth fails with 401, try bearer token if available
      if (auth.type === 'apiKey' && response.status === 401) {
        console.error('[TMDB Search] API key auth failed with 401:', {
          url: url.toString().replace(auth.value, '***'),
          apiKeyLength: auth.value.length,
          apiKeyPrefix: auth.value.substring(0, 8),
          responseBody: text.substring(0, 500),
        })
        
        // Try bearer token if available
        const envVars = getEnvVars()
        const bearerToken = normalizeToken(envVars.TMDB_READ_ACCESS_TOKEN)
        if (bearerToken) {
          console.log('[TMDB Search] Attempting bearer token fallback for API key failure')
          const bearerUrl = new URL(url.toString())
          // Remove api_key param if present
          bearerUrl.searchParams.delete('api_key')
          const bearerResponse = await fetch(bearerUrl.toString(), {
            headers: {
              'Authorization': `Bearer ${bearerToken}`,
              'accept': 'application/json'
            }
          })
          const bearerText = await bearerResponse.text()
          console.log('[TMDB Search] Bearer token fallback status:', bearerResponse.status)
          if (bearerResponse.ok) {
            return { response: bearerResponse, text: bearerText, usedFallback: true }
          }
        }
      }

      return { response, text, usedFallback: false }
    }

    const results: any[] = []

    if (type === 'movie' || type === 'mixed') {
      try {
        const movieUrl = new URL(`${TMDB_BASE_URL}/search/movie`)
        movieUrl.searchParams.set('query', query)
        movieUrl.searchParams.set('page', '1')
        if (auth.type === 'apiKey') {
          movieUrl.searchParams.set('api_key', auth.value)
        }
        console.log('[TMDB Search] Fetching movies from:', movieUrl.toString().replace(auth.value, '***'))
        
        const { response: movieResponse, text: movieResponseText } = await fetchFromTmdb(movieUrl)
        
        console.log('[TMDB Search] Movie response status:', movieResponse.status)
        console.log('[TMDB Search] Movie response body:', movieResponseText.substring(0, 500))
        
        if (!movieResponse.ok) {
          console.error('[TMDB Search] Movie search failed:', {
            status: movieResponse.status,
            statusText: movieResponse.statusText,
            body: movieResponseText.substring(0, 500),
            authType: auth.type,
            usedFallback: movieResponse.status === 401 && fallbackApiKey ? 'attempted' : 'none',
          })
          try {
            const errorData = JSON.parse(movieResponseText)
            if (errorData.status_message) {
              throw new Error(`TMDB API Error: ${errorData.status_message}`)
            }
          } catch (parseError) {
            // If we can't parse the error, throw with the status
            const errorMsg = `TMDB API returned status ${movieResponse.status}`
            if (movieResponse.status === 401) {
              throw new Error(`${errorMsg}. Please check your TMDB API key configuration.`)
            }
            throw new Error(errorMsg)
          }
        } else {
          const movieData = JSON.parse(movieResponseText)
          console.log('[TMDB Search] Movie data keys:', Object.keys(movieData))
          
          // Check for TMDB error format (even in 200 responses)
          if (movieData.status_code || movieData.status_message) {
            const errorMsg = movieData.status_message || 'Unknown TMDB error'
            console.error('[TMDB Search] TMDB returned error:', movieData.status_code, errorMsg)
            throw new Error(`TMDB API Error: ${errorMsg}`)
          } else {
            console.log('[TMDB Search] Movie results count:', movieData.results?.length || 0)
            
            if (movieData.results && Array.isArray(movieData.results)) {
              const mapped = movieData.results.map((item: any) => ({
                id: item.id,
                title: item.title,
                releaseDate: item.release_date,
                posterPath: item.poster_path,
                type: 'movie',
                overview: item.overview,
                genreIds: item.genre_ids || [],
              }))
              results.push(...mapped)
              console.log('[TMDB Search] Added', mapped.length, 'movie results')
            } else {
              console.log('[TMDB Search] No movie results array found in response')
            }
          }
        }
      } catch (error) {
        console.error('Error fetching movie search from TMDB:', error)
        // Re-throw to be caught by outer handler
        throw error
      }
    }

    if (type === 'tv' || type === 'mixed') {
      try {
        const tvUrl = new URL(`${TMDB_BASE_URL}/search/tv`)
        tvUrl.searchParams.set('query', query)
        tvUrl.searchParams.set('page', '1')
        if (auth.type === 'apiKey') {
          tvUrl.searchParams.set('api_key', auth.value)
        }
        console.log('[TMDB Search] Fetching TV from:', tvUrl.toString().replace(auth.value, '***'))
        
        const { response: tvResponse, text: tvResponseText } = await fetchFromTmdb(tvUrl)
        
        console.log('[TMDB Search] TV response status:', tvResponse.status)
        console.log('[TMDB Search] TV response body:', tvResponseText.substring(0, 500))
        
        if (!tvResponse.ok) {
          console.error('[TMDB Search] TV search failed:', {
            status: tvResponse.status,
            statusText: tvResponse.statusText,
            body: tvResponseText.substring(0, 500),
            authType: auth.type,
            usedFallback: tvResponse.status === 401 && fallbackApiKey ? 'attempted' : 'none',
          })
          try {
            const errorData = JSON.parse(tvResponseText)
            if (errorData.status_message) {
              throw new Error(`TMDB API Error: ${errorData.status_message}`)
            }
          } catch (parseError) {
            // If we can't parse the error, throw with the status
            const errorMsg = `TMDB API returned status ${tvResponse.status}`
            if (tvResponse.status === 401) {
              throw new Error(`${errorMsg}. Please check your TMDB API key configuration.`)
            }
            throw new Error(errorMsg)
          }
        } else {
          const tvData = JSON.parse(tvResponseText)
          console.log('[TMDB Search] TV data keys:', Object.keys(tvData))
          
          // Check for TMDB error format (even in 200 responses)
          if (tvData.status_code || tvData.status_message) {
            const errorMsg = tvData.status_message || 'Unknown TMDB error'
            console.error('[TMDB Search] TMDB returned error:', tvData.status_code, errorMsg)
            throw new Error(`TMDB API Error: ${errorMsg}`)
          } else {
            console.log('[TMDB Search] TV results count:', tvData.results?.length || 0)
            
            if (tvData.results && Array.isArray(tvData.results)) {
              const mapped = tvData.results.map((item: any) => ({
                id: item.id,
                title: item.name,
                releaseDate: item.first_air_date,
                posterPath: item.poster_path,
                type: 'show',
                overview: item.overview,
                genreIds: item.genre_ids || [],
              }))
              results.push(...mapped)
              console.log('[TMDB Search] Added', mapped.length, 'TV results')
            } else {
              console.log('[TMDB Search] No TV results array found in response')
            }
          }
        }
      } catch (error) {
        console.error('Error fetching TV search from TMDB:', error)
        // Re-throw to be caught by outer handler
        throw error
      }
    }

    console.log('[TMDB Search] Total results:', results.length)
    // Sort by relevance (TMDB already does this, but we can re-sort if needed)
    return NextResponse.json({ results })
  } catch (error) {
    console.error('TMDB search error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to search TMDB'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

