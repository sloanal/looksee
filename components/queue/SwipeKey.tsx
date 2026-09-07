'use client'

import { ArrowLeft, ArrowRight, Frown, Meh, Smile } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SwipeDirection } from '@/components/queue/types'

interface SwipeKeyProps {
  /** Rates the centered card. The left and right keys mirror a swipe. */
  onRate: (direction: SwipeDirection) => void
  disabled?: boolean
  className?: string
}

/**
 * The key above the deck: what each swipe direction means, doubling as buttons
 * so the deck works with a mouse, a keyboard and a screen reader. Neutral has
 * no swipe of its own — the middle key is the only way to say "no strong feeling".
 */
export function SwipeKey({ onRate, disabled = false, className }: SwipeKeyProps) {
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
        arrow='left'
        disabled={disabled}
        onClick={() => onRate('left')}
      />
      <Key
        label='Neutral'
        hint='tap'
        icon={Meh}
        disabled={disabled}
        onClick={() => onRate('down')}
      />
      <Key
        label='Excited'
        hint='swipe right'
        icon={Smile}
        arrow='right'
        disabled={disabled}
        onClick={() => onRate('right')}
      />
    </div>
  )
}

interface KeyProps {
  label: string
  hint: string
  icon: typeof Frown
  arrow?: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}

function Key({ label, hint, icon: Icon, arrow, disabled, onClick }: KeyProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label} (${hint})`}
      className='flex min-h-[52px] flex-1 flex-col items-center justify-center rounded-lg border border-input bg-background px-1.5 py-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'
    >
      <span className='flex items-center gap-1 text-xs font-semibold text-foreground'>
        {arrow === 'left' && <ArrowLeft className='h-3.5 w-3.5' aria-hidden />}
        <Icon className='h-4 w-4' aria-hidden />
        <span className='truncate'>{label}</span>
        {arrow === 'right' && <ArrowRight className='h-3.5 w-3.5' aria-hidden />}
      </span>
      <span className='mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground'>
        {hint}
      </span>
    </button>
  )
}
