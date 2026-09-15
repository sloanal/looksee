'use client'

import { ReactNode } from 'react'
import { Star } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export interface MediaDetailItem {
  title: string
  type: string
  posterUrl?: string | null
  description?: string | null
  genres: string[]
  releaseDate?: string | null
  runtimeMinutes?: number | null
  rating?: number | null
  tmdbId?: string | null
  sourceType?: string | null
}

export interface MediaCredits {
  /** Director(s) for a movie, or creator(s) for a show. */
  director: string[]
  /** Top-billed cast, in TMDB's billing order. */
  cast: string[]
}

export const isTmdbItem = (item: { tmdbId?: string | null; sourceType?: string | null }) =>
  Boolean(item.tmdbId) && item.sourceType?.toLowerCase() === 'tmdb'

export const formatReleaseDate = (releaseDate: string): string =>
  new Date(releaseDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

/** Director/cast for a TMDB item, fetched fresh on open rather than stored on the item. */
export async function fetchMediaCredits(
  item: { tmdbId?: string | null; sourceType?: string | null; type: string },
): Promise<MediaCredits | null> {
  if (!isTmdbItem(item)) return null

  try {
    const type = item.type.toLowerCase() === 'movie' ? 'movie' : 'tv'
    const res = await fetch(`/api/tmdb/credits?id=${item.tmdbId}&type=${type}`)
    if (!res.ok) return null
    const data = await res.json()
    return { director: data.director ?? [], cast: data.cast ?? [] }
  } catch (err) {
    console.error('Failed to load credits:', err)
    return null
  }
}

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className='mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
        {title}
      </h3>
      {children}
    </div>
  )
}

interface TrailerSectionProps {
  item: MediaDetailItem
  trailerUrl: string | null
  loadingTrailer: boolean
  className?: string
}

/** Trailer embed, or a quiet placeholder while loading / when TMDB has none. */
export function TrailerSection(
  { item, trailerUrl, loadingTrailer, className }: TrailerSectionProps,
) {
  if (loadingTrailer) {
    return (
      <div className={className} role='status' aria-live='polite'>
        <DetailSection title='Trailer'>
          <div className='relative aspect-video'>
            <Skeleton className='absolute inset-0 rounded-xl' />
            <div className='absolute inset-0 flex items-center justify-center'>
              <Spinner size={20} className='text-muted-foreground' />
            </div>
          </div>
        </DetailSection>
        <span className='sr-only'>Loading trailer</span>
      </div>
    )
  }
  if (trailerUrl) {
    return (
      <div className={className}>
        <DetailSection title='Trailer'>
          <div className='aspect-video overflow-hidden rounded-xl bg-foreground shadow-card'>
            <iframe
              src={trailerUrl}
              title={`${item.title} Trailer`}
              className='h-full w-full'
              allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
              allowFullScreen
            />
          </div>
        </DetailSection>
      </div>
    )
  }
  if (isTmdbItem(item)) {
    return (
      <div
        className={cn(
          'flex aspect-video items-center justify-center rounded-xl bg-muted',
          className,
        )}
      >
        <p className='text-sm text-muted-foreground'>No trailer available</p>
      </div>
    )
  }
  return null
}

/**
 * A small "where this came from" caption for data pulled in from an external
 * source rather than entered by a housemate (currently always TMDB, since
 * that's the only place a numeric rating is sourced from).
 */
export function DataSourceNote(
  { source = 'TMDB', className }: { source?: string; className?: string },
) {
  return <span className={cn('text-xs text-muted-foreground/70', className)}>via {source}</span>
}

/** The TMDB rating (out of 10), with a caption crediting where it came from. */
export function MediaRating({ rating, className }: { rating: number; className?: string }) {
  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground',
        className,
      )}
    >
      <span className='inline-flex items-center gap-1.5'>
        <Star className='h-4 w-4 fill-amber-400 text-amber-400' />
        {rating.toFixed(1)} / 10
      </span>
      <DataSourceNote />
    </p>
  )
}

/**
 * Whether a credits section has anything to occupy: either names to list, or a
 * fetch still in flight that will fill it in. Callers laying credits out beside
 * another section ask this before making room for them.
 */
export const hasCredit = (names?: string[], loadingCredits?: boolean) =>
  Boolean(loadingCredits) || (names?.length ?? 0) > 0

function CreditsSkeleton({ label }: { label: string }) {
  return (
    <div className='space-y-1.5' role='status' aria-live='polite'>
      <Skeleton className='h-3.5 w-24' />
      <Skeleton className='h-4 w-2/3' />
      <span className='sr-only'>{label}</span>
    </div>
  )
}

/** Director(s) for a movie, creator(s) for a show, named for how many there are. */
export function DirectorSection({
  type,
  credits,
  loadingCredits,
}: {
  type: string
  credits?: MediaCredits | null
  loadingCredits?: boolean
}) {
  if (loadingCredits) return <CreditsSkeleton label='Loading director' />
  if (!credits || credits.director.length === 0) return null

  const isShow = type.toLowerCase() === 'show'
  const title = isShow
    ? (credits.director.length > 1 ? 'Creators' : 'Creator')
    : (credits.director.length > 1 ? 'Directors' : 'Director')

  return (
    <DetailSection title={title}>
      <p className='text-sm text-muted-foreground'>{credits.director.join(', ')}</p>
    </DetailSection>
  )
}

/** Top-billed cast, or a quiet loading state while TMDB is asked for it. */
export function CastSection({
  credits,
  loadingCredits,
}: {
  credits?: MediaCredits | null
  loadingCredits?: boolean
}) {
  if (loadingCredits) return <CreditsSkeleton label='Loading cast' />
  if (!credits || credits.cast.length === 0) return null

  return (
    <DetailSection title='Cast'>
      <p className='text-sm text-muted-foreground'>{credits.cast.join(', ')}</p>
    </DetailSection>
  )
}
