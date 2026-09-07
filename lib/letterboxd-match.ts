import { TMDB_IMAGE_BASE, tmdbFetch } from '@/lib/tmdb-client'
import { foldText } from '@/lib/tmdb-search'
import { getGenreNames } from '@/lib/tmdb-genres'
import { LetterboxdRow } from '@/lib/letterboxd'

/** A release year this far from the export's year is a different film. */
const YEAR_TOLERANCE = 1

/** Catalog fields for a matched film, shaped like the TMDB add flow stores them. */
export type LetterboxdMatch = {
  tmdbId: string
  title: string
  posterUrl: string | null
  description: string | null
  genres: string[]
  rating: number | null
  releaseDate: string | null
}

interface TmdbMovie {
  id: number
  title?: string
  original_title?: string
  release_date?: string
  poster_path?: string | null
  overview?: string
  genre_ids?: number[]
  popularity?: number
  vote_average?: number
}

async function tmdbJson<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  try {
    const response = await tmdbFetch(path, params)
    if (!response.ok) return null
    const data = await response.json()
    return data?.status_code ? null : data as T
  } catch (error) {
    console.error(`[Letterboxd import] TMDB ${path} failed:`, error)
    return null
  }
}

const yearOf = (movie: TmdbMovie): number | null => {
  const year = parseInt((movie.release_date ?? '').slice(0, 4), 10)
  return isNaN(year) ? null : year
}

/**
 * TMDB already returns results by relevance; this only overrules that when the
 * export's own metadata disagrees, so "Nosferatu" (1922) in a watchlist does
 * not import as the 2024 remake.
 */
export function pickBestMovie(results: TmdbMovie[], row: LetterboxdRow): TmdbMovie | null {
  if (results.length === 0) return null

  const wanted = foldText(row.name)
  const exact = results.filter((movie) =>
    foldText(movie.title ?? '') === wanted || foldText(movie.original_title ?? '') === wanted
  )
  const pool = exact.length > 0 ? exact : results

  if (row.year !== null) {
    const sameYear = pool.filter((movie) => {
      const year = yearOf(movie)
      return year !== null && Math.abs(year - row.year!) <= YEAR_TOLERANCE
    })
    if (sameYear.length > 0) {
      return sameYear.reduce((best, movie) =>
        (movie.popularity ?? 0) > (best.popularity ?? 0) ? movie : best
      )
    }
  }

  return pool[0]
}

/** Letterboxd only catalogs films, so every row is looked up as a movie. */
export async function matchLetterboxdRow(row: LetterboxdRow): Promise<LetterboxdMatch | null> {
  const search = (year: number | null) =>
    tmdbJson<{ results?: TmdbMovie[] }>('/search/movie', {
      query: row.name,
      include_adult: 'false',
      page: '1',
      ...(year !== null ? { primary_release_year: String(year) } : {}),
    })

  let data = await search(row.year)
  // A year-scoped search misses films Letterboxd and TMDB date differently.
  if (row.year !== null && (data?.results ?? []).length === 0) {
    data = await search(null)
  }

  const movie = pickBestMovie(data?.results ?? [], row)
  if (!movie) return null

  return {
    tmdbId: String(movie.id),
    title: movie.title || movie.original_title || row.name,
    posterUrl: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
    description: movie.overview || null,
    genres: getGenreNames(movie.genre_ids ?? [], 'movie'),
    rating: typeof movie.vote_average === 'number' ? movie.vote_average : null,
    releaseDate: movie.release_date || null,
  }
}

/** The one catalog field the search response can't provide. */
export async function fetchMovieRuntime(tmdbId: string): Promise<number | null> {
  const data = await tmdbJson<{ runtime?: number }>(`/movie/${tmdbId}`)
  return typeof data?.runtime === 'number' && data.runtime > 0 ? data.runtime : null
}
