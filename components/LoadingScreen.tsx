import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

interface BrandLensMarkProps {
  size?: number
  className?: string
}

/**
 * Animated lens echoing the Looksee mark: the outline traces itself while the
 * pupil breathes. Pure SVG + CSS so it paints on the first frame, before any
 * data or media has loaded.
 */
export function BrandLensMark({ size = 76, className }: BrandLensMarkProps) {
  const lens = 'M2 16C8 6.5 15.5 3 24 3s16 3.5 22 13c-6 9.5-13.5 13-22 13S8 25.5 2 16Z'

  return (
    <svg
      aria-hidden
      viewBox='0 0 48 32'
      width={size}
      height={(size * 32) / 48}
      className={cn('text-foreground', className)}
    >
      <path
        d={lens}
        fill='none'
        stroke='currentColor'
        strokeWidth='2.25'
        strokeLinejoin='round'
        strokeOpacity='0.22'
      />
      <path
        d={lens}
        fill='none'
        stroke='currentColor'
        strokeWidth='2.25'
        strokeLinecap='round'
        strokeLinejoin='round'
        pathLength={1}
        className='lens-travel'
      />
      <g className='pupil-breathe'>
        <circle cx='24' cy='16' r='8.5' fill='currentColor' />
        <path d='M21.4 11.9 29 16l-7.6 4.1Z' fill='hsl(var(--canvas))' />
      </g>
    </svg>
  )
}

interface LoadingScreenProps {
  /** Replaces the default caption under the wordmark. */
  label?: string
  className?: string
}

/**
 * Full-height branded loader for the moments before we know where the user
 * belongs: the root session/room check and route transitions.
 */
export function LoadingScreen({ label = 'Getting things ready', className }: LoadingScreenProps) {
  return (
    <div
      role='status'
      aria-live='polite'
      className={cn(
        'flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-canvas px-6',
        className,
      )}
    >
      <BrandLensMark />
      <div className='text-center'>
        <p className='font-heading text-2xl font-bold tracking-tight text-foreground'>Looksee</p>
        <p className='mt-1 text-sm text-muted-foreground'>{label}</p>
      </div>
      <div className='h-1 w-32 overflow-hidden rounded-full bg-border'>
        <div className='loader-sweep h-full w-1/3 rounded-full bg-foreground/70' />
      </div>
    </div>
  )
}

interface InlineLoadingProps {
  label: string
  className?: string
}

/** Centred spinner + label for short waits inside a page or modal. */
export function InlineLoading({ label, className }: InlineLoadingProps) {
  return (
    <div
      role='status'
      aria-live='polite'
      className={cn(
        'flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground',
        className,
      )}
    >
      <Spinner />
      <span>{label}</span>
    </div>
  )
}
