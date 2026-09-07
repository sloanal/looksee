'use client'

import { useCallback, useEffect, useRef } from 'react'
import { QueueCard } from '@/components/queue/QueueCard'
import { QueueItem, SwipeDirection } from '@/components/queue/types'

/** How many cards either side of the centered one fetch their streaming providers. */
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
 * The horizontal deck of full-height cards. Panning the gutter either side of a
 * card moves through the queue without rating anything, and mandatory snapping
 * means the deck always comes to rest with one card centered.
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

  const handleScroll = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      const scroller = scrollerRef.current
      const first = scroller?.firstElementChild as HTMLElement | undefined
      if (!scroller || !first) return

      const second = scroller.children[1] as HTMLElement | undefined
      const step = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth
      if (step <= 0) return

      const index = Math.round(scroller.scrollLeft / step)
      onActiveIndexChange(Math.max(0, Math.min(items.length - 1, index)))
    })
  }, [items.length, onActiveIndexChange])

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      role='region'
      aria-label='Titles waiting for your rating'
      tabIndex={0}
      className='no-scrollbar mx-auto flex h-full w-full max-w-md snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden px-7 focus-visible:outline-none'
    >
      {items.map((item, index) => (
        <div key={item.id} className='h-full w-full flex-none snap-center py-1'>
          <QueueCard
            item={item}
            status={statusById[item.id] ?? 'have_not_seen'}
            onStatusChange={(status) =>
              onStatusChange(item.id, status)}
            onRate={(direction) =>
              onRate(item, direction)}
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
