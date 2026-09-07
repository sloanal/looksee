import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TmdbConfigError } from '@/lib/tmdb-client'
import { type SearchScope, searchTmdb } from '@/lib/tmdb-search'

const parseScope = (value: string | null): SearchScope => {
  if (value === 'movie' || value === 'tv') return value
  return 'mixed'
}

// GET /api/tmdb/search?query=...&type=movie|tv|mixed
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query')
  const scope = parseScope(searchParams.get('type'))

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
  }

  try {
    const data = await searchTmdb(query, scope)
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof TmdbConfigError) {
      console.error('[TMDB Search] API key not configured')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.error('[TMDB Search] Search failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to search TMDB'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
