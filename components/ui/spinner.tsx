import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: number
  className?: string
}

/** Inline activity ring in `currentColor`, for buttons and short waits. */
export function Spinner({ size = 16, className }: SpinnerProps) {
  return (
    <svg
      aria-hidden
      viewBox='0 0 24 24'
      width={size}
      height={size}
      className={cn('spinner-spin flex-shrink-0', className)}
    >
      <circle
        cx='12'
        cy='12'
        r='9'
        fill='none'
        stroke='currentColor'
        strokeWidth='2.5'
        strokeOpacity='0.2'
      />
      <path
        d='M21 12a9 9 0 0 0-9-9'
        fill='none'
        stroke='currentColor'
        strokeWidth='2.5'
        strokeLinecap='round'
      />
    </svg>
  )
}
