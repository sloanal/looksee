'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatRuntime } from '@/components/MediaCard'
import {
  CastSection,
  DetailSection,
  DirectorSection,
  fetchMediaCredits,
  formatReleaseDate,
  hasCredit,
  isTmdbItem,
  MediaCredits,
  MediaDetailItem,
  MediaRating,
  TrailerSection,
} from '@/components/MediaDetail'
import {
  HouseholdMember,
  HouseholdPreference,
  HouseholdUser,
} from '@/components/HouseholdExcitementRow'
import { PosterImage } from '@/components/PosterImage'
import { StreamingProviders } from '@/components/StreamingProviders'
import { AddedBySection, RecommendedBySection, SubmissionInfo } from '@/components/SubmissionMeta'
import { WhoWantsToWatch } from '@/components/WhoWantsToWatch'
import { cn } from '@/lib/utils'

export interface TitleDetailPreference extends HouseholdPreference {
  /** The viewer's own note on who put them onto this, kept private to them. */
  recommendedByName?: string | null
  recommendationContext?: string | null
}

export interface TitleDetailItem extends MediaDetailItem {
  id: string
  myPreference?: TitleDetailPreference | null
  otherPreferences?: HouseholdMember[] | null
  submission?: SubmissionInfo | null
}

interface TitleDetailProps {
  item: TitleDetailItem
  viewer?: HouseholdUser | null
  /** Off for a queue card that isn't in the frame: no trailer fetched or shown. */
  trailer?: boolean
  /** Off for a queue card far from the frame: skips credits and where-to-watch. */
  extras?: boolean
  className?: string
}

/**
 * Everything the app has to say about a title, in one order everywhere it is
 * shown: the poster and the facts, the trailer, then who wants to watch it,
 * where it came from and where to watch it. The Browse and Watch overlays put
 * this inside a dialog and the New deck scrolls it inside a swipe card, so all
 * three read the same.
 */
export function TitleDetail({
  item,
  viewer,
  trailer = true,
  extras = true,
  className,
}: TitleDetailProps) {
  const { trailerUrl, loadingTrailer, credits, loadingCredits } = useTitleMedia(item, {
    trailer,
    extras,
  })
  const tmdb = isTmdbItem(item)
  const showRuntime = typeof item.runtimeMinutes === 'number' && item.runtimeMinutes > 0
  const showDirector = hasCredit(credits?.director, loadingCredits)
  const showRating = typeof item.rating === 'number' && item.rating > 0

  return (
    <div className={cn('space-y-6', className)} data-testid='title-detail'>
      <div className='grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]'>
        <div className='mx-auto aspect-[2/3] w-full max-w-[260px] overflow-hidden rounded-xl shadow-card'>
          <PosterImage
            src={item.posterUrl}
            alt={item.title}
            width={300}
            height={450}
            className='h-full w-full object-cover'
          />
        </div>

        <div className='space-y-5'>
          {item.description && (
            <DetailSection title='Description'>
              <p className='text-sm leading-relaxed text-muted-foreground'>{item.description}</p>
            </DetailSection>
          )}

          {(showDirector || item.releaseDate) && (
            <DetailPair>
              <DirectorSection type={item.type} credits={credits} loadingCredits={loadingCredits} />
              {item.releaseDate && (
                <DetailSection title='Release date'>
                  <p className='text-sm text-muted-foreground'>
                    {formatReleaseDate(item.releaseDate)}
                  </p>
                </DetailSection>
              )}
            </DetailPair>
          )}

          <CastSection credits={credits} loadingCredits={loadingCredits} />

          {item.genres.length > 0 && (
            <DetailSection title='Genres'>
              <div className='flex flex-wrap gap-1.5'>
                {item.genres.map((genre, i) => <Badge key={i}>{genre}</Badge>)}
              </div>
            </DetailSection>
          )}

          {(showRating || showRuntime) && (
            <DetailPair>
              {showRating && (
                <DetailSection title='Rating'>
                  <MediaRating rating={item.rating as number} />
                </DetailSection>
              )}
              {showRuntime && (
                <DetailSection title='Runtime'>
                  <p className='text-sm text-muted-foreground'>
                    {formatRuntime(item.runtimeMinutes as number, item.type)}
                  </p>
                </DetailSection>
              )}
            </DetailPair>
          )}
        </div>
      </div>

      {trailer && (
        <TrailerSection item={item} trailerUrl={trailerUrl} loadingTrailer={loadingTrailer} />
      )}

      <WhoWantsToWatch
        myPreference={item.myPreference}
        viewer={viewer}
        otherPreferences={item.otherPreferences}
      />

      <AddedBySection submission={item.submission} />

      <RecommendedBySection mine={item.myPreference} submission={item.submission} />

      {tmdb && extras && <StreamingProviders tmdbId={item.tmdbId!} type={item.type} />}
    </div>
  )
}

/**
 * Two short facts side by side, so a pair like release date and director reads
 * as one line of the card rather than two stacked sections. Stays two columns
 * at every width: both sides hold a handful of words at most.
 */
function DetailPair({ children }: { children: ReactNode }) {
  return <div className='grid grid-cols-2 gap-x-4 gap-y-5'>{children}</div>
}

/**
 * The bits of a title that aren't stored with it: the trailer and the credits,
 * both fetched from TMDB on demand. Each is fetched at most once per title, so
 * a queue card that leaves the frame and comes back doesn't ask again.
 */
function useTitleMedia(
  item: TitleDetailItem,
  { trailer, extras }: { trailer: boolean; extras: boolean },
) {
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null)
  const [loadingTrailer, setLoadingTrailer] = useState(false)
  const [credits, setCredits] = useState<MediaCredits | null>(null)
  const [loadingCredits, setLoadingCredits] = useState(false)
  const fetchedTrailer = useRef<string | null>(null)
  const fetchedCredits = useRef<string | null>(null)

  const tmdb = isTmdbItem(item)
  const { id, tmdbId, sourceType, type } = item

  // A reply is kept only while it is still the title being asked about, and
  // the spinner is always cleared: a fetch abandoned on cleanup would leave
  // the section spinning forever, since the ref won't let it be asked twice.
  useEffect(() => {
    if (!trailer || !tmdb || fetchedTrailer.current === id) return
    fetchedTrailer.current = id

    setTrailerUrl(null)
    setLoadingTrailer(true)
    const kind = type.toLowerCase() === 'movie' ? 'movie' : 'tv'
    fetch(`/api/tmdb/videos?id=${tmdbId}&type=${kind}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (fetchedTrailer.current === id && data?.trailer?.url) setTrailerUrl(data.trailer.url)
      })
      .catch((err) => console.error('Failed to load trailer:', err))
      .finally(() => setLoadingTrailer(false))
  }, [trailer, tmdb, id, tmdbId, type])

  useEffect(() => {
    if (!extras || !tmdb || fetchedCredits.current === id) return
    fetchedCredits.current = id

    setCredits(null)
    setLoadingCredits(true)
    fetchMediaCredits({ tmdbId, sourceType, type })
      .then((result) => {
        if (fetchedCredits.current === id) setCredits(result)
      })
      .finally(() => setLoadingCredits(false))
  }, [extras, tmdb, id, tmdbId, sourceType, type])

  return { trailerUrl, loadingTrailer, credits, loadingCredits }
}
