'use client'

import {
  PointerEvent as ReactPointerEvent,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Eye, EyeOff, Sofa } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CardGenres, CardMeta } from '@/components/MediaCard'
import { DetailSection, TrailerSection } from '@/components/MediaDetail'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import { FavoriteButton, FavoritedByBadge } from '@/components/FavoriteButton'
import { HouseholdExcitementRow } from '@/components/HouseholdExcitementRow'
import { PosterImage } from '@/components/PosterImage'
import { choiceClassName, STATUS_OPTIONS } from '@/components/RatingFields'
import { StreamingProviders } from '@/components/StreamingProviders'
import { SubmissionMeta } from '@/components/SubmissionMeta'
import { cn } from '@/lib/utils'
import { favoritedByNames, getTypeIcon, QueueItem, SwipeDirection } from '@/components/queue/types'

/** Horizontal travel that commits a swipe, as a share of the card's width. */
const COMMIT_RATIO = 0.28
const MIN_COMMIT_PX = 64
/** How far a finger must move sideways before we take the gesture from the deck. */
const ENGAGE_PX = 10
const EXIT_MS = 260
const SPRING_BACK = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface QueueCardProps {
  item: QueueItem
  /** The viewer's seen/not-seen choice, saved alongside the swipe. */
  status: string
  onStatusChange: (status: string) => void
  /** Fired once the card has animated off the deck. */
  onRate: (direction: SwipeDirection) => void
  onFavoriteChange: (isFavorite: boolean) => void
  /** The centered card: gets the trailer and owns the keyboard/tap shortcuts. */
  active: boolean
  /** Near enough to the centre to be worth fetching streaming providers for. */
  detailed: boolean
  /** Set by the key buttons to fly this card out without a drag. */
  requestedExit: SwipeDirection | null
  disabled?: boolean
}

export function QueueCard({
  item,
  status,
  onStatusChange,
  onRate,
  onFavoriteChange,
  active,
  detailed,
  requestedExit,
  disabled = false,
}: QueueCardProps) {
  const motionRef = useRef<HTMLDivElement>(null)
  const yesRef = useRef<HTMLDivElement>(null)
  const noRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<{ id: number; x: number; y: number; engaged: boolean } | null>(null)
  const leavingRef = useRef(false)

  const [trailerUrl, setTrailerUrl] = useState<string | null>(null)
  const [loadingTrailer, setLoadingTrailer] = useState(false)

  const isTmdb = Boolean(item.tmdbId) && item.sourceType?.toLowerCase() === 'tmdb'
  const others = item.otherPreferences ?? []

  useEffect(() => {
    if (!active || !isTmdb || trailerUrl) return
    let cancelled = false
    const type = item.type.toLowerCase() === 'movie' ? 'movie' : 'tv'

    setLoadingTrailer(true)
    fetch(`/api/tmdb/videos?id=${item.tmdbId}&type=${type}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.trailer?.url) setTrailerUrl(data.trailer.url)
      })
      .catch((err) => console.error('Failed to load trailer:', err))
      .finally(() => {
        if (!cancelled) setLoadingTrailer(false)
      })

    return () => {
      cancelled = true
    }
  }, [active, isTmdb, item.tmdbId, item.type, trailerUrl])

  const commitDistance = () =>
    Math.max(MIN_COMMIT_PX, (motionRef.current?.offsetWidth ?? 320) * COMMIT_RATIO)

  const paint = useCallback((x: number) => {
    const progress = Math.min(1, Math.abs(x) / commitDistance())
    if (motionRef.current) {
      motionRef.current.style.transform = `translate3d(${x}px, 0, 0) rotate(${x / 26}deg)`
    }
    if (yesRef.current) yesRef.current.style.opacity = x > 0 ? String(progress) : '0'
    if (noRef.current) noRef.current.style.opacity = x < 0 ? String(progress) : '0'
  }, [])

  /**
   * Fly the card away as a copy pinned to the viewport, and report the rating
   * straight away so the next card slides into the empty slot behind it. The
   * deck clips on both axes to scroll horizontally, so a card animating inside
   * it would simply be cut off at the edge.
   */
  const startExit = useCallback((direction: SwipeDirection) => {
    if (leavingRef.current) return
    leavingRef.current = true

    const el = motionRef.current
    const card = el?.firstElementChild as HTMLElement | null

    if (el && card && !prefersReducedMotion()) {
      // Measure where the card sits without the drag offset, then hand that
      // offset to the copy so it picks up exactly where the finger left it.
      const dragTransform = el.style.transform
      const dragTransition = el.style.transition
      el.style.transition = 'none'
      el.style.transform = 'none'
      const rect = card.getBoundingClientRect()
      el.style.transform = dragTransform
      el.style.transition = dragTransition

      const ghost = card.cloneNode(true) as HTMLElement
      ghost.setAttribute('aria-hidden', 'true')
      ghost.setAttribute('inert', '')
      Object.assign(ghost.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: '0',
        zIndex: '45',
        pointerEvents: 'none',
        willChange: 'transform, opacity',
        transform: dragTransform || 'none',
      })
      // A cloned iframe would start a fresh load just to be thrown away.
      ghost.querySelectorAll('iframe').forEach((frame) => frame.remove())
      document.body.appendChild(ghost)

      const readingPosition = card.querySelector('[data-card-scroll]')?.scrollTop
      const ghostBody = ghost.querySelector('[data-card-scroll]')
      if (ghostBody && readingPosition) ghostBody.scrollTop = readingPosition

      // Neutral drops away under the bottom nav; the header sits above the deck
      // and a card rising through it would just look like a collision.
      const offscreen = direction === 'down'
        ? 'translate3d(0, 125%, 0)'
        : `translate3d(${direction === 'right' ? '' : '-'}135%, 0, 0) rotate(${
          direction === 'right' ? 18 : -18
        }deg)`

      ghost.getBoundingClientRect()
      ghost.style.transition = `transform ${EXIT_MS}ms ease-out, opacity ${EXIT_MS}ms ease-out`
      ghost.style.transform = offscreen
      ghost.style.opacity = '0'
      window.setTimeout(() => ghost.remove(), EXIT_MS + 80)
    }

    onRate(direction)
  }, [onRate])

  useEffect(() => {
    if (requestedExit) startExit(requestedExit)
  }, [requestedExit, startExit])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || leavingRef.current) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, engaged: false }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current
    if (!pointer || pointer.id !== event.pointerId || leavingRef.current) return

    const dx = event.clientX - pointer.x
    const dy = event.clientY - pointer.y

    if (!pointer.engaged) {
      // Let anything that reads as a vertical scroll stay a vertical scroll.
      if (Math.abs(dx) < ENGAGE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
      pointer.engaged = true
      event.currentTarget.setPointerCapture(event.pointerId)
      if (motionRef.current) motionRef.current.style.transition = 'none'
    }

    paint(dx)
  }

  const settle = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const pointer = pointerRef.current
    pointerRef.current = null
    if (!pointer || pointer.id !== event.pointerId || !pointer.engaged) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const dx = event.clientX - pointer.x
    if (!cancelled && Math.abs(dx) >= commitDistance()) {
      startExit(dx > 0 ? 'right' : 'left')
      return
    }

    if (motionRef.current) motionRef.current.style.transition = SPRING_BACK
    paint(0)
  }

  return (
    <div
      ref={motionRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => settle(event, false)}
      onPointerCancel={(event) => settle(event, true)}
      // pan-y keeps vertical reading native while horizontal drags belong to us.
      className='relative h-full touch-pan-y select-none'
    >
      <article
        className='flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-pop'
        aria-label={item.title}
      >
        <SwipeOverlay overlayRef={noRef} tone='no' />
        <SwipeOverlay overlayRef={yesRef} tone='yes' />

        <div className='flex flex-shrink-0 items-center gap-2 border-b border-border bg-muted/60 py-1 pl-4 pr-1'>
          <DuotoneIcon icon={Sofa} size={14} className='flex-shrink-0' />
          <div className='flex min-w-0 flex-1 flex-wrap items-center gap-1.5'>
            {(item.rooms ?? []).map((room) => (
              <Badge key={room.id} variant='outline' size='sm'>
                {room.name}
              </Badge>
            ))}
          </div>
          <FavoriteButton
            mediaItemId={item.id}
            isFavorite={item.myPreference?.isFavorite === true}
            onChange={onFavoriteChange}
            size={18}
            className='h-9 w-9'
          />
        </div>

        <div className='relative min-h-0 flex-1'>
          <div
            data-card-scroll
            className='h-full space-y-4 overflow-y-auto overscroll-contain px-4 py-4'
          >
            <div className='flex gap-4'>
              <PosterImage
                src={item.posterUrl}
                alt={item.title}
                width={104}
                height={156}
                className='flex-shrink-0 rounded-lg object-cover shadow-sm'
              />
              <div className='min-w-0 flex-1'>
                <h2 className='mb-1 text-xl font-semibold leading-tight text-foreground'>
                  {item.title}
                </h2>
                <CardMeta
                  icon={getTypeIcon(item.type)}
                  type={item.type}
                  releaseDate={item.releaseDate}
                  runtimeMinutes={item.runtimeMinutes}
                />
                <CardGenres genres={item.genres} maxDisplay={3} />
                <FavoritedByBadge names={favoritedByNames(item)} />
              </div>
            </div>

            {others.length > 0 && (
              <DetailSection title='Your rooms'>
                <HouseholdExcitementRow otherPreferences={others} />
              </DetailSection>
            )}

            {item.description && (
              <DetailSection title='Description'>
                <p className='text-sm leading-relaxed text-muted-foreground'>{item.description}</p>
              </DetailSection>
            )}

            {detailed && isTmdb && <StreamingProviders tmdbId={item.tmdbId!} type={item.type} />}

            {active && (
              <TrailerSection item={item} trailerUrl={trailerUrl} loadingTrailer={loadingTrailer} />
            )}

            <SubmissionMeta submission={item.submission} className='pt-1' />
          </div>
          {/* Hints that the card keeps going below the fold. */}
          <div
            aria-hidden
            className='pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-card to-transparent'
          />
        </div>

        <div className='flex-shrink-0 border-t border-border bg-muted/60 px-3 py-3'>
          <div className='flex gap-2' role='group' aria-label='Have you seen this?'>
            {STATUS_OPTIONS.map((option) => {
              const checked = status === option.value
              return (
                <button
                  key={option.value}
                  type='button'
                  aria-pressed={checked}
                  onClick={() => onStatusChange(option.value)}
                  className={choiceClassName(checked)}
                >
                  {option.value === 'already_seen'
                    ? <Eye className='h-4 w-4 flex-shrink-0' aria-hidden />
                    : <EyeOff className='h-4 w-4 flex-shrink-0' aria-hidden />}
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </article>
    </div>
  )
}

interface SwipeOverlayProps {
  tone: 'yes' | 'no'
  overlayRef: RefObject<HTMLDivElement>
}

/**
 * The "Excited" / "Not excited" stamp that fades in as a card is dragged. Each
 * stamp sits on the edge the card is dragged away from, so it stays on screen
 * for the whole gesture instead of leaving with the edge it is chasing.
 */
function SwipeOverlay({ tone, overlayRef }: SwipeOverlayProps) {
  return (
    <div
      ref={overlayRef}
      aria-hidden
      style={{ opacity: 0 }}
      className={cn(
        'pointer-events-none absolute top-16 z-10 rounded-lg border-2 px-3 py-1.5 text-sm font-bold uppercase tracking-wide',
        tone === 'yes'
          ? 'left-4 -rotate-12 border-primary bg-primary text-primary-foreground'
          : 'right-4 rotate-12 border-destructive bg-destructive text-destructive-foreground',
      )}
    >
      {tone === 'yes' ? 'Excited' : 'Not excited'}
    </div>
  )
}
