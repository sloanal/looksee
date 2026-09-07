'use client'

import { ReactNode } from 'react'
import Image from 'next/image'
import { Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { formatRuntime } from '@/components/MediaCard'
import { StreamingProviders } from '@/components/StreamingProviders'
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

/** Director/creator and top-billed cast, or a quiet loading state while they're fetched. */
export function CreditsSection({
  type,
  credits,
  loadingCredits,
}: {
  type: string
  credits?: MediaCredits | null
  loadingCredits?: boolean
}) {
  if (loadingCredits) {
    return (
      <div className='space-y-1.5' role='status' aria-live='polite'>
        <Skeleton className='h-3.5 w-24' />
        <Skeleton className='h-4 w-2/3' />
        <span className='sr-only'>Loading cast and crew</span>
      </div>
    )
  }

  if (!credits || (credits.director.length === 0 && credits.cast.length === 0)) return null

  const isShow = type.toLowerCase() === 'show'
  const directorTitle = isShow
    ? (credits.director.length > 1 ? 'Creators' : 'Creator')
    : (credits.director.length > 1 ? 'Directors' : 'Director')

  return (
    <>
      {credits.director.length > 0 && (
        <DetailSection title={directorTitle}>
          <p className='text-sm text-muted-foreground'>{credits.director.join(', ')}</p>
        </DetailSection>
      )}
      {credits.cast.length > 0 && (
        <DetailSection title='Cast'>
          <p className='text-sm text-muted-foreground'>{credits.cast.join(', ')}</p>
        </DetailSection>
      )}
    </>
  )
}

interface MediaDetailBodyProps {
  item: MediaDetailItem
  trailerUrl: string | null
  loadingTrailer: boolean
  /** Director/cast, fetched fresh on open; omit while unavailable (e.g. non-TMDB items). */
  credits?: MediaCredits | null
  loadingCredits?: boolean
  /** Extra sections in the facts column (e.g. "Recommended by"). */
  children?: ReactNode
}

/**
 * Poster + facts grid and trailer shared by the Browse, Watch and New detail
 * modals. Callers add their own header, household rows and rating form.
 */
export function MediaDetailBody(
  { item, trailerUrl, loadingTrailer, credits, loadingCredits, children }: MediaDetailBodyProps,
) {
  const showRuntime = typeof item.runtimeMinutes === 'number' && item.runtimeMinutes > 0

  return (
    <>
      <div className='mb-6 grid grid-cols-1 gap-6 md:grid-cols-2'>
        {item.posterUrl && (
          <div className='mx-auto w-full max-w-[260px] flex-shrink-0 md:mx-0 md:max-w-none'>
            <Image
              src={item.posterUrl}
              alt={item.title}
              width={300}
              height={450}
              className='w-full rounded-xl object-cover shadow-card'
            />
          </div>
        )}

        <div className='space-y-5'>
          {isTmdbItem(item) && <StreamingProviders tmdbId={item.tmdbId!} type={item.type} />}

          {item.description && (
            <DetailSection title='Description'>
              <p className='text-sm leading-relaxed text-muted-foreground'>{item.description}</p>
            </DetailSection>
          )}

          <CreditsSection type={item.type} credits={credits} loadingCredits={loadingCredits} />

          {item.genres.length > 0 && (
            <DetailSection title='Genres'>
              <div className='flex flex-wrap gap-1.5'>
                {item.genres.map((genre, i) => <Badge key={i}>{genre}</Badge>)}
              </div>
            </DetailSection>
          )}

          {showRuntime && (
            <DetailSection title='Runtime'>
              <p className='text-sm text-muted-foreground'>
                {formatRuntime(item.runtimeMinutes as number, item.type)}
              </p>
            </DetailSection>
          )}

          {item.releaseDate && (
            <DetailSection title='Release date'>
              <p className='text-sm text-muted-foreground'>{formatReleaseDate(item.releaseDate)}</p>
            </DetailSection>
          )}

          {item.rating && (
            <DetailSection title='Rating'>
              <MediaRating rating={item.rating} />
            </DetailSection>
          )}

          {children}
        </div>
      </div>

      <TrailerSection
        item={item}
        trailerUrl={trailerUrl}
        loadingTrailer={loadingTrailer}
        className='mb-6'
      />
    </>
  )
}
