import { isTmdbConfigured, tmdbFetch } from '@/lib/tmdb-client'

const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92'

const CACHE_TTL_MS = 12 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 2000

export type ProviderMediaType = 'movie' | 'show'

export interface Provider {
  id: number
  name: string
  logoUrl: string
}

export interface WatchProviders {
  region: string
  link: string | null
  flatrate: Provider[]
  rent: Provider[]
  buy: Provider[]
}

interface CacheEntry {
  value: WatchProviders
  expiresAt: number
}

// Module-level so every request handler in this process shares one cache.
// Next.js dev hot reloads reset it, which is fine.
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<WatchProviders>>()

export function emptyProviders(region: string): WatchProviders {
  return { region, link: null, flatrate: [], rent: [], buy: [] }
}

export function normalizeRegion(value: string | null | undefined): string | null {
  if (!value) return 'US'
  const trimmed = value.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null
}

export function normalizeProviderType(value: string | null | undefined): ProviderMediaType | null {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'movie') return 'movie'
  if (normalized === 'show' || normalized === 'tv') return 'show'
  return null
}

export function normalizeTmdbId(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed && /^\d+$/.test(trimmed) ? trimmed : null
}

interface TmdbProvider {
  provider_id: number
  provider_name: string
  logo_path: string | null
  display_priority?: number
}

const mapProviders = (list: TmdbProvider[] | undefined): Provider[] =>
  (list ?? [])
    .filter((p) => p && typeof p.provider_id === 'number' && p.provider_name)
    .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
    .map((p) => ({
      id: p.provider_id,
      name: p.provider_name,
      logoUrl: p.logo_path ? `${TMDB_LOGO_BASE}${p.logo_path}` : '',
    }))

async function fetchFromTmdb(
  tmdbId: string,
  type: ProviderMediaType,
  region: string,
): Promise<{ value: WatchProviders; cacheable: boolean }> {
  if (!isTmdbConfigured()) {
    console.error('[TMDB Providers] API key not configured')
    return { value: emptyProviders(region), cacheable: false }
  }

  const endpoint = type === 'movie' ? 'movie' : 'tv'
  const response = await tmdbFetch(`/${endpoint}/${tmdbId}/watch/providers`)

  // 404 means TMDB has no such title; that is a stable "nothing to show".
  if (response.status === 404) {
    return { value: emptyProviders(region), cacheable: true }
  }
  if (!response.ok) {
    console.error('[TMDB Providers] TMDB responded', response.status, 'for', type, tmdbId)
    return { value: emptyProviders(region), cacheable: false }
  }

  const data = await response.json()
  const regionData = data?.results?.[region]
  if (!regionData) {
    return { value: emptyProviders(region), cacheable: true }
  }

  return {
    cacheable: true,
    value: {
      region,
      link: typeof regionData.link === 'string' ? regionData.link : null,
      flatrate: mapProviders(regionData.flatrate),
      rent: mapProviders(regionData.rent),
      buy: mapProviders(regionData.buy),
    },
  }
}

function setCached(key: string, value: WatchProviders) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const now = Date.now()
    cache.forEach((entry, k) => {
      if (entry.expiresAt <= now) cache.delete(k)
    })
    // Map iterates in insertion order, so the first key is the oldest.
    while (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value
      if (oldest === undefined) break
      cache.delete(oldest)
    }
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
}

export async function getWatchProviders(
  tmdbId: string,
  type: ProviderMediaType,
  region: string,
): Promise<{ value: WatchProviders; cached: boolean }> {
  const key = `${type}:${tmdbId}:${region}`
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return { value: hit.value, cached: true }
  }
  if (hit) cache.delete(key)

  let pending = inflight.get(key)
  if (!pending) {
    pending = (async () => {
      try {
        const { value, cacheable } = await fetchFromTmdb(tmdbId, type, region)
        if (cacheable) setCached(key, value)
        return value
      } catch (error) {
        console.error('[TMDB Providers] Fetch failed for', key, error)
        return emptyProviders(region)
      } finally {
        inflight.delete(key)
      }
    })()
    inflight.set(key, pending)
  }

  return { value: await pending, cached: false }
}
