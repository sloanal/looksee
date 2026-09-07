import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getWatchProviders,
  normalizeProviderType,
  normalizeRegion,
  normalizeTmdbId,
} from '@/lib/tmdb-providers'

// GET /api/tmdb/providers?tmdbId=...&type=movie|show[&region=US]
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const tmdbId = normalizeTmdbId(searchParams.get('tmdbId'))
  const type = normalizeProviderType(searchParams.get('type'))
  const region = normalizeRegion(searchParams.get('region'))

  if (!tmdbId || !type) {
    return NextResponse.json(
      { error: 'tmdbId (numeric) and type (movie|show) parameters are required' },
      { status: 400 },
    )
  }
  if (!region) {
    return NextResponse.json({ error: 'region must be a 2-letter country code' }, { status: 400 })
  }

  const { value, cached } = await getWatchProviders(tmdbId, type, region)
  return NextResponse.json(value, {
    headers: {
      'x-cache': cached ? 'HIT' : 'MISS',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
