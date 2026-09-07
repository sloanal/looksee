import { TmdbConfigError, tmdbFetch } from '@/lib/tmdb-client'

const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX_ENTRIES = 500
const PERSON_CREDITS_LIMIT = 12
const STRONG_PERSON_MIN_POPULARITY = 3
const PERSON_CANDIDATES = 5
const KNOWN_FOR_PEOPLE_LIMIT = 2
// Obscure same-named entries (TMDB popularity well under 1) stay where TMDB ranked them.
const EXACT_HOIST_MIN_POPULARITY = 1

export type SearchScope = 'movie' | 'tv' | 'mixed'
export type SearchMediaType = 'movie' | 'show'
export type SearchSource = 'title' | 'person'

export interface SearchVia {
  personId: number
  name: string
  role: string | null
}

export interface SearchResultItem {
  id: number
  title: string
  releaseDate: string | null
  posterPath: string | null
  type: SearchMediaType
  overview: string
  genreIds: number[]
  popularity: number
  source: SearchSource
  via?: SearchVia
}

export interface SearchResponse {
  results: SearchResultItem[]
}

interface TmdbMediaLike {
  id: number
  media_type?: string
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  overview?: string
  genre_ids?: number[]
  popularity?: number
  vote_count?: number
}

interface TmdbCredit extends TmdbMediaLike {
  character?: string
  job?: string
  department?: string
}

interface TmdbPerson {
  id: number
  name: string
  popularity?: number
  known_for?: TmdbMediaLike[]
}

interface CacheEntry {
  value: SearchResponse
  expiresAt: number
}

// Module-level so every request handler in this process shares one cache.
const cache = new Map<string, CacheEntry>()

async function fetchTmdbJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const response = await tmdbFetch(path, params)

  const text = await response.text()
  let data: any = null
  try {
    data = JSON.parse(text)
  } catch {
    data = null
  }

  if (!response.ok || data?.status_code) {
    const message = data?.status_message || `TMDB API returned status ${response.status}`
    throw new Error(`TMDB API Error: ${message}`)
  }
  return data as T
}

// Built at runtime because the tsconfig target predates the `u` flag.
const NON_ALNUM = new RegExp('[^\\p{L}\\p{N}\\s]+', 'gu')

export function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export const foldText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(NON_ALNUM, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Conversational filler ("that florence pugh movie") that TMDB's exact-word search chokes on.
const FILLER_WORDS = new Set([
  'that',
  'this',
  'the',
  'a',
  'an',
  'one',
  'movie',
  'movies',
  'film',
  'films',
  'show',
  'shows',
  'series',
  'tv',
  'with',
  'starring',
  'about',
  'where',
  'called',
])

// Looser variant used only when the raw query returns no title hits: punctuation and
// filler words are dropped. Returns '' when nothing meaningful remains.
export function simplifyQuery(query: string): string {
  const words = foldText(query).split(' ').filter(Boolean)
  const kept = words.filter((word) => !FILLER_WORDS.has(word))
  return (kept.length > 0 ? kept : words.filter((word) => word !== 'the')).join(' ')
}

const titleKey = (value: string) => foldText(value).replace(/^the /, '')

const isStrongPersonMatch = (person: TmdbPerson, foldedQuery: string) => {
  if ((person.popularity ?? 0) < STRONG_PERSON_MIN_POPULARITY) return false
  if (foldedQuery.length < 3) return false
  const foldedName = foldText(person.name || '')
  if (!foldedName) return false
  return foldedName.includes(foldedQuery) || foldedQuery.includes(foldedName)
}

const isWeakPersonMatch = (person: TmdbPerson, foldedQuery: string) => {
  if ((person.popularity ?? 0) < STRONG_PERSON_MIN_POPULARITY) return false
  const nameTokens = new Set(foldText(person.name || '').split(' ').filter(Boolean))
  return foldedQuery
    .split(' ')
    .some((token) => token.length >= 3 && nameTokens.has(token))
}

const mediaTypeFor = (item: TmdbMediaLike, fallback?: SearchMediaType): SearchMediaType | null => {
  if (item.media_type === 'movie') return 'movie'
  if (item.media_type === 'tv') return 'show'
  return fallback ?? null
}

const inScope = (type: SearchMediaType, scope: SearchScope) =>
  scope === 'mixed' || (scope === 'movie' && type === 'movie') ||
  (scope === 'tv' && type === 'show')

const toResult = (
  item: TmdbMediaLike,
  type: SearchMediaType,
  source: SearchSource,
  via?: SearchVia,
): SearchResultItem => ({
  id: item.id,
  title: (type === 'movie' ? item.title : item.name) || item.title || item.name || 'Untitled',
  releaseDate: (type === 'movie' ? item.release_date : item.first_air_date) || null,
  posterPath: item.poster_path ?? null,
  type,
  overview: item.overview || '',
  genreIds: Array.isArray(item.genre_ids) ? item.genre_ids : [],
  popularity: typeof item.popularity === 'number' ? item.popularity : 0,
  source,
  ...(via ? { via } : {}),
})

const searchTitles = async (
  endpoint: 'movie' | 'tv',
  query: string,
): Promise<SearchResultItem[]> => {
  const data = await fetchTmdbJson<{ results?: TmdbMediaLike[] }>(`/search/${endpoint}`, {
    query,
    page: '1',
    include_adult: 'false',
  })
  const type: SearchMediaType = endpoint === 'movie' ? 'movie' : 'show'
  return (data.results ?? []).map((item) => toResult(item, type, 'title'))
}

const searchPeople = async (query: string): Promise<TmdbPerson[]> => {
  const data = await fetchTmdbJson<{ results?: TmdbPerson[] }>('/search/person', {
    query,
    page: '1',
    include_adult: 'false',
  })
  return data.results ?? []
}

const SELF_CHARACTER = /\b(self|himself|herself|themselves|archive footage|narrator|guest)\b/i
// TMDB TV genres Talk (10767), News (10763) and Reality (10764) credits are guest
// appearances, not filmography.
const APPEARANCE_GENRES = new Set([10767, 10763, 10764])

const CREW_ROLE_BY_JOB: Record<string, string> = {
  Director: 'Director',
  Creator: 'Creator',
  Writer: 'Writer',
  Screenplay: 'Writer',
  Story: 'Writer',
  Teleplay: 'Writer',
  'Co-Writer': 'Writer',
}
const ROLE_PRIORITY: Record<string, number> = { Director: 0, Creator: 1, Writer: 2, Actor: 3 }

const fetchPersonCredits = async (
  person: TmdbPerson,
  scope: SearchScope,
): Promise<SearchResultItem[]> => {
  const data = await fetchTmdbJson<{ cast?: TmdbCredit[]; crew?: TmdbCredit[] }>(
    `/person/${person.id}/combined_credits`,
    {},
  )

  const byKey = new Map<string, { credit: TmdbCredit; type: SearchMediaType; role: string }>()
  const consider = (credit: TmdbCredit, role: string) => {
    const type = mediaTypeFor(credit)
    if (!type || !inScope(type, scope)) return
    if ((credit.genre_ids ?? []).some((g) => APPEARANCE_GENRES.has(g))) return
    const key = `${type}-${credit.id}`
    const existing = byKey.get(key)
    if (!existing || ROLE_PRIORITY[role] < ROLE_PRIORITY[existing.role]) {
      byKey.set(key, { credit, type, role })
    }
  }

  for (const credit of data.cast ?? []) {
    if (credit.character && SELF_CHARACTER.test(credit.character)) continue
    consider(credit, 'Actor')
  }
  for (const credit of data.crew ?? []) {
    const role = credit.job ? CREW_ROLE_BY_JOB[credit.job] : undefined
    if (role) consider(credit, role)
  }

  return Array.from(byKey.values())
    .sort((a, b) =>
      (b.credit.popularity ?? 0) - (a.credit.popularity ?? 0) ||
      (b.credit.vote_count ?? 0) - (a.credit.vote_count ?? 0)
    )
    .slice(0, PERSON_CREDITS_LIMIT)
    .map(({ credit, type, role }) =>
      toResult(credit, type, 'person', { personId: person.id, name: person.name, role })
    )
}

const knownForResults = (people: TmdbPerson[], scope: SearchScope): SearchResultItem[] => {
  const results: SearchResultItem[] = []
  for (const person of people) {
    for (const item of person.known_for ?? []) {
      const type = mediaTypeFor(item)
      if (!type || !inScope(type, scope)) continue
      results.push(
        toResult(item, type, 'person', { personId: person.id, name: person.name, role: null }),
      )
    }
  }
  return results
}

// Tracks whether any TMDB call in this search was swallowed, so degraded results are
// returned but never cached.
interface SearchState {
  degraded: boolean
}

const settle = <T>(state: SearchState, promise: Promise<T>, label: string, fallback: T) =>
  promise.catch((error) => {
    if (error instanceof TmdbConfigError) throw error
    console.error(`[TMDB Search] ${label} failed:`, error)
    state.degraded = true
    return fallback
  })

const runTitleSearches = (query: string, scope: SearchScope) => {
  const jobs: Promise<SearchResultItem[]>[] = []
  if (scope !== 'tv') jobs.push(searchTitles('movie', query))
  if (scope !== 'movie') jobs.push(searchTitles('tv', query))
  return Promise.allSettled(jobs)
}

// Movie and TV lists each keep TMDB's own order and are interleaved by rank so a mixed
// search does not bury every show behind every movie. Exact title matches float to the
// top, most popular first, so "Breaking Bad" means the show and not a same-named short.
const rankTitles = (lists: SearchResultItem[][], foldedQuery: string): SearchResultItem[] => {
  const interleaved: SearchResultItem[] = []
  const longest = Math.max(0, ...lists.map((list) => list.length))
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      if (i < list.length) interleaved.push(list[i])
    }
  }
  const wanted = titleKey(foldedQuery)
  if (!wanted) return interleaved
  const isExact = (item: SearchResultItem) =>
    item.popularity >= EXACT_HOIST_MIN_POPULARITY && titleKey(item.title) === wanted
  const exact = interleaved.filter(isExact).sort((a, b) => b.popularity - a.popularity)
  const rest = interleaved.filter((item) => !isExact(item))
  return [...exact, ...rest]
}

const matchPeople = (people: TmdbPerson[], foldedQuery: string) => {
  const candidates = people.slice(0, PERSON_CANDIDATES)
  const strong = candidates
    .filter((person) => isStrongPersonMatch(person, foldedQuery))
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0]
  const weak = strong ? [] : candidates
    .filter((person) => isWeakPersonMatch(person, foldedQuery))
    .slice(0, KNOWN_FOR_PEOPLE_LIMIT)
  return { strong, weak }
}

/**
 * Title search (movie + tv) plus people search. TMDB call budget per uncached query:
 * movie + tv + person in parallel (3), plus one combined_credits call for a strong
 * person match (4). Only when the raw query yields zero title hits do we retry once
 * with a simplified variant (title searches, plus the person search if nobody matched).
 */
export async function searchTmdb(rawQuery: string, scope: SearchScope): Promise<SearchResponse> {
  const query = normalizeQuery(rawQuery)
  let foldedQuery = foldText(query)
  const cacheKey = `${scope}:${foldedQuery}`

  const hit = cache.get(cacheKey)
  if (hit && hit.expiresAt > Date.now()) return hit.value
  if (hit) cache.delete(cacheKey)

  const state: SearchState = { degraded: false }

  const [titleSettled, people] = await Promise.all([
    runTitleSearches(query, scope),
    settle(state, searchPeople(query), 'person search', [] as TmdbPerson[]),
  ])

  let titleLists = collectTitles(state, titleSettled)
  let { strong, weak } = matchPeople(people, foldedQuery)

  if (titleLists.every((list) => list.length === 0)) {
    const simplified = simplifyQuery(query)
    if (simplified && simplified !== foldedQuery) {
      const nobodyMatched = !strong && weak.length === 0
      const [retrySettled, retryPeople] = await Promise.all([
        runTitleSearches(simplified, scope),
        nobodyMatched
          ? settle(state, searchPeople(simplified), 'person search (retry)', [] as TmdbPerson[])
          : Promise.resolve([] as TmdbPerson[]),
      ])
      titleLists = collectTitles(state, retrySettled)
      if (nobodyMatched) {
        const matched = matchPeople(retryPeople, simplified)
        strong = matched.strong
        weak = matched.weak
      }
      foldedQuery = simplified
    }
  }

  const titleResults = rankTitles(titleLists, foldedQuery)

  let personResults: SearchResultItem[] = []
  if (strong) {
    personResults = await settle(
      state,
      fetchPersonCredits(strong, scope),
      `credits for person ${strong.id}`,
      [] as SearchResultItem[],
    )
  } else {
    personResults = knownForResults(weak, scope)
  }

  const seen = new Set<string>()
  const results: SearchResultItem[] = []
  for (const item of [...titleResults, ...personResults]) {
    const key = `${item.type}-${item.id}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push(item)
  }

  const value: SearchResponse = { results }
  if (!state.degraded) setCached(cacheKey, value)
  return value
}

// One list per endpoint searched. A single failed endpoint is tolerated; if every title
// search failed (e.g. bad credentials) the error propagates so the route can report it.
function collectTitles(
  state: SearchState,
  settled: PromiseSettledResult<SearchResultItem[]>[],
): SearchResultItem[][] {
  const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  for (const r of rejected) {
    if (r.reason instanceof TmdbConfigError) throw r.reason
  }
  if (settled.length > 0 && rejected.length === settled.length) {
    throw rejected[0].reason
  }
  for (const r of rejected) {
    console.error('[TMDB Search] title search failed:', r.reason)
    state.degraded = true
  }
  return settled.map((r) => (r.status === 'fulfilled' ? r.value : []))
}

function setCached(key: string, value: SearchResponse) {
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
