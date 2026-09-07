'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUp, Frown, Meh, Smile } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SwipeDirection } from '@/components/queue/types'

/** Long enough for the press to read, short enough to keep up with tapping. */
const FIRE_MS = 420

interface SwipeKeyProps {
  /** Rates the card in the frame. The left and right keys mirror a swipe. */
  onRate: (direction: SwipeDirection) => void
  disabled?: boolean
  className?: string
}

/**
 * The key above the deck: what each direction means, doubling as buttons so the
 * deck works with a mouse, a keyboard and a screen reader. Neutral has no swipe
 * of its own — the middle key is the only way to say "no strong feeling" — so
 * pressing it throws the card upwards.
 */
export function SwipeKey({ onRate, disabled = false, className }: SwipeKeyProps) {
  const [firing, setFiring] = useState<SwipeDirection | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])

  const fire = (direction: SwipeDirection) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    setFiring(direction)
    timerRef.current = window.setTimeout(() => setFiring(null), FIRE_MS)
    onRate(direction)
  }

  return (
    <div
      className={cn('flex items-stretch gap-2', className)}
      role='group'
      aria-label='Rate the title in front'
    >
      <Key
        label='Not excited'
        hint='swipe left'
        icon={Frown}
        direction='left'
        firing={firing === 'left'}
        disabled={disabled}
        onClick={() => fire('left')}
      />
      <Key
        label='Neutral'
        hint='tap'
        icon={Meh}
        direction='up'
        firing={firing === 'up'}
        disabled={disabled}
        onClick={() => fire('up')}
      />
      <Key
        label='Excited'
        hint='swipe right'
        icon={Smile}
        direction='right'
        firing={firing === 'right'}
        disabled={disabled}
        onClick={() => fire('right')}
      />
    </div>
  )
}

const ARROW: Record<SwipeDirection, typeof ArrowLeft> = {
  left: ArrowLeft,
  up: ArrowUp,
  right: ArrowRight,
}

interface KeyProps {
  label: string
  hint: string
  icon: typeof Frown
  direction: SwipeDirection
  firing: boolean
  disabled: boolean
  onClick: () => void
}

function Key({ label, hint, icon: Icon, direction, firing, disabled, onClick }: KeyProps) {
  const Arrow = ARROW[direction]
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label} (${hint})`}
      className={cn(
        'relative flex min-h-[52px] flex-1 flex-col items-center justify-center overflow-hidden rounded-lg border border-input bg-background px-1.5 py-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        firing && 'key-firing border-foreground bg-accent',
      )}
    >
      {/* A wash that leaves in the direction the card was just thrown. */}
      {firing && <span aria-hidden className={`key-wash key-wash-${direction}`} />}
      <span className='relative flex items-center gap-1 text-xs font-semibold text-foreground'>
        {direction === 'left' && (
          <Arrow className={cn('h-3.5 w-3.5', firing && 'key-nudge-left')} aria-hidden />
        )}
        <Icon
          className={cn('h-4 w-4', firing && `key-nudge-${direction}`)}
          aria-hidden
        />
        <span className='truncate'>{label}</span>
        {direction === 'right' && (
          <Arrow className={cn('h-3.5 w-3.5', firing && 'key-nudge-right')} aria-hidden />
        )}
      </span>
      <span className='relative mt-0.5 flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground'>
        {direction === 'up' && (
          <Arrow className={cn('h-2.5 w-2.5', firing && 'key-nudge-up')} aria-hidden />
        )}
        {hint}
      </span>
    </button>
  )
}
