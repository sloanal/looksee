'use client'

import { useCallback, useEffect, useRef } from 'react'
import { QueueCard } from '@/components/queue/QueueCard'
import { QueueItem, SwipeDirection } from '@/components/queue/types'

/** How many cards either side of the one in the frame fetch streaming providers. */
const DETAIL_WINDOW = 1

interface QueueDeckProps {
  items: QueueItem[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  /** Seen/not-seen choice per title, keyed by media item id. */
  statusById: Record<string, string>
  onStatusChange: (itemId: string, status: string) => void
  onRate: (item: QueueItem, direction: SwipeDirection) => void
  onFavoriteChange: (itemId: string, isFavorite: boolean) => void
  /** A card asked to leave by the key buttons rather than a drag. */
  exit: { itemId: string; direction: SwipeDirection } | null
  disabled?: boolean
}

/**
 * The queue as a vertical list of cards, one frame tall apiece. Scrolling is
 * the only way through it, which leaves left and right entirely to the swipe
 * gesture, and rating a card lets the ones below simply close the gap.
 *
 * Snapping is mandatory so a card always comes to rest filling the frame
 * instead of halfway into it, and `snap-always` keeps a hard flick from
 * skipping over a title on the way past.
 */
export function QueueDeck({
  items,
  activeIndex,
  onActiveIndexChange,
  statusById,
  onStatusChange,
  onRate,
  onFavoriteChange,
  exit,
  disabled = false,
}: QueueDeckProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
  }, [])

  /**
   * The card "in front" is whichever one covers most of the frame, which holds
   * up for cards taller than the frame as well as short ones.
   */
  const handleScroll = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      const scroller = scrollerRef.current
      if (!scroller) return

      // Measured against the frame rather than through offsetTop, which is
      // relative to whichever ancestor happens to be positioned.
      const frame = scroller.getBoundingClientRect()
      let best = 0
      let bestVisible = -1

      Array.from(scroller.children).forEach((child, index) => {
        const rect = (child as HTMLElement).getBoundingClientRect()
        const visible = Math.min(frame.bottom, rect.bottom) - Math.max(frame.top, rect.top)
        if (visible > bestVisible) {
          bestVisible = visible
          best = index
        }
      })

      onActiveIndexChange(Math.max(0, Math.min(items.length - 1, best)))
    })
  }, [items.length, onActiveIndexChange])

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      role='region'
      aria-label='Titles waiting for your rating'
      tabIndex={0}
      className='no-scrollbar mx-auto h-full w-full max-w-md snap-y snap-mandatory space-y-3 overflow-y-auto overflow-x-hidden px-4 focus-visible:outline-none'
    >
      {items.map((item, index) => (
        <div key={item.id} className='h-full snap-start snap-always'>
          <QueueCard
            item={item}
            status={statusById[item.id] ?? 'have_not_seen'}
            onStatusChange={(status) => onStatusChange(item.id, status)}
            onRate={(direction) => onRate(item, direction)}
            onFavoriteChange={(isFavorite) => onFavoriteChange(item.id, isFavorite)}
            active={index === activeIndex}
            detailed={Math.abs(index - activeIndex) <= DETAIL_WINDOW}
            requestedExit={exit?.itemId === item.id ? exit.direction : null}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  )
}
