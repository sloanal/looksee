import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * The resting frame of the welcome animation, drawn as SVG: the eye with a
 * play button for a pupil, and the "i" folded into a play triangle.
 */
export function LogoMark(
  { className, cutout = 'hsl(var(--canvas))' }: { className?: string; cutout?: string },
) {
  return (
    <svg viewBox='12 14 372 236' aria-hidden className={cn('h-6 w-auto', className)}>
      <path
        d='M20 128C66 74 142 46 258 56V202C142 212 66 182 20 128Z'
        fill='currentColor'
      />
      <circle cx='181' cy='129' r='68' fill={cutout} />
      <circle cx='181' cy='129' r='39' fill='currentColor' />
      <path d='M171 111V147L199 129Z' fill={cutout} />
      <path d='M272 70L372 128L362 137L272 221Z' fill='currentColor' />
      <path d='M374 150V246H270Z' fill='currentColor' />
      <circle cx='338' cy='40' r='20' fill='currentColor' />
    </svg>
  )
}

export function Logo(
  { className, href = '/', inverted = false }: { className?: string; href?: string; inverted?: boolean },
) {
  return (
    <Link
      href={href}
      aria-label='Looksee home'
      className={cn(
        'group inline-flex items-center gap-2.5 rounded-md text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        className,
      )}
    >
      <LogoMark
        cutout={inverted ? 'hsl(var(--ink))' : undefined}
        className='h-6 transition-transform duration-500 ease-spring group-hover:-rotate-6 group-hover:scale-110'
      />
      <span className='font-display text-lg leading-none'>Looksee</span>
    </Link>
  )
}
