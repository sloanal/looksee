import { NextRequest, NextResponse } from 'next/server'

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// GET /api/tmdb/search?query=...&type=movie|tv|mixed
export async function GET(request: NextRequest) {
  if (!TMDB_API_KEY) {
    console.error('[TMDB Search] API key not configured')
    return NextResponse.json({ error: 'TMDB API key not configured' }, { status: 500 })
  }
  
  if (TMDB_API_KEY.length < 10) {
    console.error('[TMDB Search] API key appears invalid (too short):', TMDB_API_KEY.substring(0, 5) + '...')
    return NextResponse.json({ error: 'TMDB API key appears invalid' }, { status: 500 })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query')
  const type = searchParams.get('type') || 'mixed'

  console.log('[TMDB Search] Request:', { query, type, hasApiKey: !!TMDB_API_KEY })

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
  }

  try {
    const results: any[] = []

    if (type === 'movie' || type === 'mixed') {
      try {
        const movieUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`
        console.log('[TMDB Search] Fetching movies from:', movieUrl.replace(TMDB_API_KEY!, '***'))
        
        const movieResponse = await fetch(movieUrl)
        const movieResponseText = await movieResponse.text()
        
        console.log('[TMDB Search] Movie response status:', movieResponse.status)
        console.log('[TMDB Search] Movie response body:', movieResponseText.substring(0, 500))
        
        if (!movieResponse.ok) {
          console.error('TMDB movie search failed:', movieResponse.status, movieResponseText)
          try {
            const errorData = JSON.parse(movieResponseText)
            if (errorData.status_message) {
              throw new Error(`TMDB API Error: ${errorData.status_message}`)
            }
          } catch (parseError) {
            // If we can't parse the error, throw with the status
            throw new Error(`TMDB API returned status ${movieResponse.status}`)
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
        const tvUrl = `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`
        console.log('[TMDB Search] Fetching TV from:', tvUrl.replace(TMDB_API_KEY!, '***'))
        
        const tvResponse = await fetch(tvUrl)
        const tvResponseText = await tvResponse.text()
        
        console.log('[TMDB Search] TV response status:', tvResponse.status)
        console.log('[TMDB Search] TV response body:', tvResponseText.substring(0, 500))
        
        if (!tvResponse.ok) {
          console.error('TMDB TV search failed:', tvResponse.status, tvResponseText)
          try {
            const errorData = JSON.parse(tvResponseText)
            if (errorData.status_message) {
              throw new Error(`TMDB API Error: ${errorData.status_message}`)
            }
          } catch (parseError) {
            // If we can't parse the error, throw with the status
            throw new Error(`TMDB API returned status ${tvResponse.status}`)
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

