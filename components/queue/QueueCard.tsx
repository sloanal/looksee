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
const ENGAGE_PX = 8
/** A drag is horizontal once it outpaces its own vertical drift by this much. */
const HORIZONTAL_BIAS = 1.2
const EXIT_MS = 460

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
  /** The card filling the frame: gets the trailer and the key buttons' attention. */
  active: boolean
  /** Near enough to the frame to be worth fetching streaming providers for. */
  detailed: boolean
  /** Set by the key buttons to fly this card out without a drag. */
  requestedExit: SwipeDirection | null
  disabled?: boolean
}

interface DragState {
  /** Pointer id for mouse drags; null for touch, which we track natively. */
  pointerId: number | null
  x: number
  y: number
  /** Horizontal travel at the last move, so the end of the drag needn't carry it. */
  dx: number
  /** We own the gesture and the browser must keep its hands off it. */
  engaged: boolean
  /** Read as a scroll, so the deck keeps it for the rest of the touch. */
  surrendered: boolean
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
  const neutralRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const leavingRef = useRef(false)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

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

  const commitDistance = useCallback(
    () => Math.max(MIN_COMMIT_PX, (motionRef.current?.offsetWidth ?? 320) * COMMIT_RATIO),
    [],
  )

  const paint = useCallback((x: number) => {
    const progress = Math.min(1, Math.abs(x) / commitDistance())
    if (motionRef.current) {
      motionRef.current.style.transform = `translate3d(${x}px, 0, 0) rotate(${x / 26}deg)`
    }
    if (yesRef.current) yesRef.current.style.opacity = x > 0 ? String(progress) : '0'
    if (noRef.current) noRef.current.style.opacity = x < 0 ? String(progress) : '0'
  }, [commitDistance])

  const springBack = useCallback(() => {
    const el = motionRef.current
    if (!el) return
    el.style.transition = 'none'
    // A spring rather than an ease: a card that didn't make it should feel like
    // it was pulled back, so the commit distance is something you can feel.
    el.animate(
      [
        { transform: el.style.transform || 'none' },
        { transform: 'translate3d(0, 0, 0) rotate(0deg)' },
      ],
      { duration: 340, easing: 'cubic-bezier(0.2, 1.5, 0.4, 1)', fill: 'forwards' },
    ).onfinish = () => {
      el.style.transform = ''
      el.getAnimations().forEach((animation) => animation.cancel())
    }
    for (const stamp of [yesRef.current, noRef.current]) {
      if (stamp) stamp.style.opacity = '0'
    }
  }, [])

  /**
   * Fly the card away as a copy pinned to the viewport, and report the rating
   * straight away so the rest of the queue closes the gap behind it. A card
   * animating inside the deck would be clipped at the edge of the scroller.
   *
   * `deliberate` marks an exit that came from a key button rather than a drag:
   * nothing has moved yet, so the card winds up before it launches.
   */
  const startExit = useCallback((direction: SwipeDirection, deliberate: boolean) => {
    if (leavingRef.current) return
    leavingRef.current = true

    const el = motionRef.current
    const card = el?.firstElementChild as HTMLElement | null

    if (el && card && !prefersReducedMotion()) {
      // Show what was chosen before the copy is taken, so the stamp rides out
      // with the card on a key press the same way it does on a drag.
      const stamp = direction === 'right'
        ? yesRef.current
        : direction === 'left'
        ? noRef.current
        : neutralRef.current
      if (stamp) {
        stamp.style.opacity = '1'
        if (deliberate) {
          stamp.animate(
            [
              { transform: `${stamp.dataset.tilt} scale(0.6)`, opacity: 0 },
              { transform: `${stamp.dataset.tilt} scale(1.12)`, opacity: 1, offset: 0.55 },
              { transform: `${stamp.dataset.tilt} scale(1)`, opacity: 1 },
            ],
            { duration: 260, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
          )
        }
      }

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
        // Under the sticky header and the bottom nav, so a card thrown upwards
        // slides beneath the key it was rated with instead of over the top.
        zIndex: '5',
        pointerEvents: 'none',
        willChange: 'transform, opacity',
      })
      // A cloned iframe would start a fresh load just to be thrown away.
      ghost.querySelectorAll('iframe').forEach((frame) => frame.remove())
      // Outside the scroller the sticky footer would latch onto the viewport
      // instead of the card, so it flies out where it was drawn.
      ghost.querySelectorAll<HTMLElement>('[data-card-footer]').forEach((footer) => {
        footer.style.position = 'static'
      })
      document.body.appendChild(ghost)

      const start = dragTransform || 'translate3d(0, 0, 0)'
      ghost.animate(exitFrames(direction, start, deliberate), {
        duration: deliberate ? EXIT_MS : EXIT_MS * 0.7,
        easing: 'linear',
        fill: 'forwards',
      }).onfinish = () => ghost.remove()
      window.setTimeout(() => ghost.remove(), EXIT_MS + 250)
    }

    onRate(direction)
  }, [onRate])

  useEffect(() => {
    if (requestedExit) startExit(requestedExit, true)
  }, [requestedExit, startExit])

  const settle = useCallback((dx: number, cancelled: boolean) => {
    if (!cancelled && Math.abs(dx) >= commitDistance()) {
      startExit(dx > 0 ? 'right' : 'left', false)
      return
    }
    springBack()
  }, [commitDistance, springBack, startExit])

  /**
   * Touch is handled natively rather than through React's pointer events: the
   * moment a horizontal drag is recognised we have to `preventDefault` a still
   * cancelable `touchmove`, or the browser hands the touch to the deck's
   * vertical scroller and cancels the gesture out from under us.
   */
  useEffect(() => {
    const el = motionRef.current
    if (!el) return

    const onTouchStart = (event: TouchEvent) => {
      if (disabledRef.current || leavingRef.current || event.touches.length !== 1) return
      const touch = event.touches[0]
      dragRef.current = {
        pointerId: null,
        x: touch.clientX,
        y: touch.clientY,
        dx: 0,
        engaged: false,
        surrendered: false,
      }
    }

    const onTouchMove = (event: TouchEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== null || drag.surrendered || leavingRef.current) return

      const touch = event.touches[0]
      if (!touch) return
      const dx = touch.clientX - drag.x
      const dy = touch.clientY - drag.y

      if (!drag.engaged) {
        // Anything that reads as scrolling stays scrolling, for this whole touch.
        if (Math.abs(dy) > ENGAGE_PX && Math.abs(dy) >= Math.abs(dx)) {
          drag.surrendered = true
          return
        }
        if (Math.abs(dx) < ENGAGE_PX || Math.abs(dx) < Math.abs(dy) * HORIZONTAL_BIAS) return
        drag.engaged = true
        el.style.transition = 'none'
      }

      if (event.cancelable) event.preventDefault()
      drag.dx = dx
      paint(dx)
    }

    const onTouchEnd = (event: TouchEvent) => {
      const drag = dragRef.current
      dragRef.current = null
      if (!drag || drag.pointerId !== null || !drag.engaged) return
      settle(drag.dx, event.type === 'touchcancel')
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [paint, settle])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || leavingRef.current) return
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dx: 0,
      engaged: false,
      surrendered: false,
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || leavingRef.current) return

    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y

    if (!drag.engaged) {
      if (Math.abs(dx) < ENGAGE_PX || Math.abs(dx) < Math.abs(dy) * HORIZONTAL_BIAS) return
      drag.engaged = true
      event.currentTarget.setPointerCapture(event.pointerId)
      if (motionRef.current) motionRef.current.style.transition = 'none'
    }

    drag.dx = dx
    paint(dx)
  }

  const endPointerDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const drag = dragRef.current
    // A touch drag is settled by the native handlers below, and its pointerup
    // arrives first — clearing it here would strand the gesture mid-flight.
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (!drag.engaged) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    settle(drag.dx, cancelled)
  }

  return (
    <div
      ref={motionRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => endPointerDrag(event, false)}
      onPointerCancel={(event) => endPointerDrag(event, true)}
      // pan-y keeps scrolling the queue native; horizontal drags belong to us.
      className='relative min-h-full touch-pan-y select-none'
    >
      <article
        className='flex min-h-full flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-pop'
        aria-label={item.title}
      >
        <SwipeOverlay overlayRef={noRef} tone='no' />
        <SwipeOverlay overlayRef={neutralRef} tone='neutral' />
        <SwipeOverlay overlayRef={yesRef} tone='yes' />

        <div className='flex flex-shrink-0 items-center gap-2 rounded-t-2xl border-b border-border bg-muted/60 py-1 pl-4 pr-1'>
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

        <div className='flex-1 space-y-4 px-4 py-4'>
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

        {
          /*
          Sticks to the bottom of the frame for as long as its card spans it, so
          the seen choice is always to hand, then leaves with the card.
        */
        }
        <div
          data-card-footer
          className='sticky bottom-0 flex-shrink-0 rounded-b-2xl border-t border-border bg-muted/95 px-3 py-3 backdrop-blur-sm'
        >
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

/**
 * The path a rated card takes off the screen. A key press winds the card up
 * against its travel first, which gives the throw somewhere to come from;
 * a drag is already moving, so it just keeps going.
 */
function exitFrames(
  direction: SwipeDirection,
  start: string,
  deliberate: boolean,
): Keyframe[] {
  const launch = 'cubic-bezier(0.32, 0, 0.67, 0)'
  const windUp = 'cubic-bezier(0.33, 1, 0.68, 1)'

  if (direction === 'up') {
    return [
      { transform: start, opacity: 1, easing: windUp },
      ...(deliberate
        ? [{
          transform: 'translate3d(0, 14px, 0) scale(0.96)',
          opacity: 1,
          offset: 0.26,
          easing: launch,
        }]
        : []),
      { transform: 'translate3d(0, -125%, 0) scale(0.82)', opacity: 0 },
    ]
  }

  const sign = direction === 'right' ? 1 : -1
  return [
    { transform: start, opacity: 1, easing: windUp },
    ...(deliberate
      ? [{
        transform: `translate3d(${-18 * sign}px, 6px, 0) rotate(${-2 * sign}deg) scale(0.97)`,
        opacity: 1,
        offset: 0.26,
        easing: launch,
      }]
      : []),
    {
      transform: `translate3d(${135 * sign}%, 4%, 0) rotate(${24 * sign}deg) scale(0.9)`,
      opacity: 0,
    },
  ]
}

interface SwipeOverlayProps {
  tone: 'yes' | 'no' | 'neutral'
  overlayRef: RefObject<HTMLDivElement>
}

const OVERLAY_TILT: Record<SwipeOverlayProps['tone'], string> = {
  yes: 'rotate(-12deg)',
  no: 'rotate(12deg)',
  neutral: 'rotate(-3deg)',
}

/**
 * The stamp that fades in as a card is rated. Left and right sit on the edge
 * the card is dragged away from, so each stays on screen for the whole
 * gesture instead of leaving with the edge it is chasing.
 */
function SwipeOverlay({ tone, overlayRef }: SwipeOverlayProps) {
  return (
    <div
      ref={overlayRef}
      aria-hidden
      data-tilt={OVERLAY_TILT[tone]}
      style={{ opacity: 0, transform: OVERLAY_TILT[tone] }}
      className={cn(
        'pointer-events-none absolute top-16 z-10 rounded-lg border-2 px-3 py-1.5 text-sm font-bold uppercase tracking-wide',
        tone === 'yes' && 'left-4 border-primary bg-primary text-primary-foreground',
        tone === 'no' && 'right-4 border-destructive bg-destructive text-destructive-foreground',
        tone === 'neutral' &&
          'left-1/2 -ml-[3.25rem] border-muted-foreground bg-muted-foreground text-background',
      )}
    >
      {tone === 'yes' ? 'Excited' : tone === 'no' ? 'Not excited' : 'Neutral'}
    </div>
  )
}
