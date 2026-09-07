'use client'

import { ReactNode } from 'react'
import Image from 'next/image'
import { Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { StreamingProviders } from '@/components/StreamingProviders'
import { cn } from '@/lib/utils'

export interface MediaDetailItem {
  title: string
  type: string
  posterUrl?: string | null
  description?: string | null
  genres: string[]
  releaseDate?: string | null
  rating?: number | null
  tmdbId?: string | null
  sourceType?: string | null
}

export const isTmdbItem = (item: { tmdbId?: string | null; sourceType?: string | null }) =>
  Boolean(item.tmdbId) && item.sourceType?.toLowerCase() === 'tmdb'

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

interface MediaDetailBodyProps {
  item: MediaDetailItem
  trailerUrl: string | null
  loadingTrailer: boolean
  /** Extra sections in the facts column (e.g. "Recommended by"). */
  children?: ReactNode
}

/**
 * Poster + facts grid and trailer shared by the Browse, Watch and New detail
 * modals. Callers add their own header, household rows and rating form.
 */
export function MediaDetailBody(
  { item, trailerUrl, loadingTrailer, children }: MediaDetailBodyProps,
) {
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

          {item.genres.length > 0 && (
            <DetailSection title='Genres'>
              <div className='flex flex-wrap gap-1.5'>
                {item.genres.map((genre, i) => <Badge key={i}>{genre}</Badge>)}
              </div>
            </DetailSection>
          )}

          {item.releaseDate && (
            <DetailSection title='Release date'>
              <p className='text-sm text-muted-foreground'>
                {new Date(item.releaseDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </DetailSection>
          )}

          {item.rating && (
            <DetailSection title='Rating'>
              <p className='flex items-center gap-2 text-sm text-muted-foreground'>
                <Star className='h-4 w-4 fill-amber-400 text-amber-400' />
                {item.rating.toFixed(1)} / 10
              </p>
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
