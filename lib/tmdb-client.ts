const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

export type TmdbParams = Record<string, string | number | undefined>

export interface TmdbFetchInit {
  signal?: AbortSignal
  next?: NextFetchRequestConfig
}

export class TmdbConfigError extends Error {
  constructor() {
    super('TMDB API key not configured')
    this.name = 'TmdbConfigError'
  }
}

interface TmdbCredentials {
  bearer: string | null
  apiKey: string | null
}

const normalizeToken = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  const stripped = trimmed.toLowerCase().startsWith('bearer ') ? trimmed.slice(7).trim() : trimmed
  return stripped || null
}

const isJwt = (value: string) => {
  const segments = value.split('.')
  return segments.length === 3 && segments.every(Boolean)
}

// v3 API keys are 32 hex chars; JWT-shaped or much longer values are v4 tokens.
const looksLikeBearer = (value: string) => isJwt(value) || value.length > 40

// A v4 read access token carries the account's v3 key in its `aud` claim.
const apiKeyFromJwt = (token: string): string | null => {
  try {
    const payload = Buffer.from(
      token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf-8')
    const aud = JSON.parse(payload).aud
    return typeof aud === 'string' && aud ? aud : null
  } catch {
    return null
  }
}

// Real v4 read access tokens are JWTs. A non-JWT value in that slot would 401 on every
// call and force the api_key retry, so it is only used as a bearer when it is JWT-shaped
// (or when there is nothing else to try).
const getCredentials = (): TmdbCredentials => {
  const token = normalizeToken(process.env.TMDB_API_READ_ACCESS_TOKEN)
  const key = normalizeToken(process.env.TMDB_API_KEY)

  let bearer = token && isJwt(token) ? token : null
  let apiKey = key && !looksLikeBearer(key) ? key : null

  if (!bearer && key && looksLikeBearer(key)) bearer = key
  if (!bearer && !apiKey && token) bearer = token
  if (!apiKey && bearer && isJwt(bearer)) apiKey = apiKeyFromJwt(bearer)

  return { bearer, apiKey }
}

export function isTmdbConfigured(): boolean {
  const { bearer, apiKey } = getCredentials()
  return Boolean(bearer || apiKey)
}

/**
 * Fetches `https://api.themoviedb.org/3${path}` with the configured credentials.
 * Prefers the v4 bearer token when it is a JWT, otherwise the v3 `api_key` query param.
 * A 401 on a bearer attempt is retried once with the api_key as a safety net.
 * Throws TmdbConfigError when neither credential is configured.
 */
export async function tmdbFetch(
  path: string,
  params: TmdbParams = {},
  init: TmdbFetchInit = {},
): Promise<Response> {
  const { bearer, apiKey } = getCredentials()
  if (!bearer && !apiKey) throw new TmdbConfigError()

  const url = new URL(`${TMDB_BASE_URL}${path}`)
  Object.keys(params).forEach((key) => {
    const value = params[key]
    if (value !== undefined) url.searchParams.set(key, String(value))
  })

  const request = (headers: HeadersInit) =>
    fetch(url.toString(), { headers, signal: init.signal, next: init.next })

  if (bearer) {
    const response = await request({
      Authorization: `Bearer ${bearer}`,
      accept: 'application/json',
    })
    if (response.status !== 401 || !apiKey) return response
  }

  url.searchParams.set('api_key', apiKey as string)
  return request({ accept: 'application/json' })
}
