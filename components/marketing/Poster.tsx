import { cn } from '@/lib/utils'
import type { DemoTitle } from './demo-data'

interface PosterProps {
  title: DemoTitle
  className?: string
  /** Hide the printed title, for very small posters. */
  bare?: boolean
}

/**
 * A made-up film poster in the brand's print style: flat inks, one bold
 * geometric idea, the title set in expanded caps at the foot.
 */
export function Poster({ title, className, bare = false }: PosterProps) {
  const { bg, fg } = title
  const lightBg = bg.includes('canvas') || bg.includes('marigold')
  const text = lightBg ? 'hsl(var(--ink))' : 'hsl(var(--canvas))'

  return (
    <div
      className={cn(
        'relative aspect-[2/3] overflow-hidden rounded-md shadow-card ring-1 ring-black/10',
        className,
      )}
      style={{ background: bg, containerType: 'inline-size' }}
      aria-hidden
    >
      <svg viewBox='0 0 100 150' className='absolute inset-0 h-full w-full'>
        <defs>
          <pattern id={`dots-${title.id}`} width='4' height='4' patternUnits='userSpaceOnUse'>
            <circle cx='2' cy='2' r='0.85' fill={text} opacity='0.55' />
          </pattern>
        </defs>
        <Art style={title.poster} bg={bg} fg={fg} text={text} dots={`url(#dots-${title.id})`} />
      </svg>
      {!bare && (
        <div className='absolute inset-x-0 bottom-0 p-[8%]'>
          <p
            className='font-display text-[clamp(0.45rem,11cqw,1.4rem)] uppercase leading-[0.95]'
            style={{ color: text }}
          >
            {title.title}
          </p>
          <p
            className='mt-[3%] text-[clamp(0.35rem,5cqw,0.65rem)] font-medium uppercase tracking-[0.2em] opacity-70'
            style={{ color: text }}
          >
            {title.year}
          </p>
        </div>
      )}
    </div>
  )
}

function Art(
  { style, bg, fg, text, dots }: { style: DemoTitle['poster']; bg: string; fg: string; text: string; dots: string },
) {
  switch (style) {
    case 'moon':
      return (
        <>
          <rect x='0' y='0' width='100' height='150' fill={dots} opacity='0.35' />
          <circle cx='58' cy='48' r='30' fill={fg} />
          <circle cx='70' cy='40' r='26' fill={bg} />
          <path d='M0 98 Q25 88 50 98 T100 98 V150 H0Z' fill='hsl(var(--ink))' opacity='0.85' />
        </>
      )
    case 'stripes':
      return (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x='-20' y={14 + i * 13} width='140' height='6' fill={fg} transform='rotate(-14 50 50)' />
          ))}
          <circle cx='30' cy='42' r='10' fill={text} />
        </>
      )
    case 'wave':
      return (
        <>
          <circle cx='50' cy='44' r='26' fill={dots} />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M0 ${60 + i * 10} Q25 ${52 + i * 10} 50 ${60 + i * 10} T100 ${60 + i * 10}`} stroke={fg} strokeWidth='4' fill='none' />
          ))}
        </>
      )
    case 'sun':
      return (
        <>
          <circle cx='50' cy='58' r='34' fill={fg} />
          <rect x='0' y='58' width='100' height='92' fill='hsl(var(--ink))' opacity='0.9' />
          <circle cx='50' cy='58' r='16' fill={dots} />
        </>
      )
    case 'grid':
      return (
        <>
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2].map((c) => (
              <rect
                key={`${r}-${c}`}
                x={14 + c * 26}
                y={12 + r * 19}
                width='20'
                height='13'
                rx='1.5'
                fill={(r + c) % 3 === 0 ? 'hsl(var(--riso-marigold))' : fg}
                opacity={(r + c) % 3 === 0 ? 1 : 0.88}
              />
            ))
          )}
        </>
      )
    case 'eye':
      return (
        <>
          <path d='M10 55 Q50 15 90 55 Q50 95 10 55Z' fill={fg} />
          <circle cx='50' cy='55' r='14' fill='hsl(var(--ink))' />
          <circle cx='54' cy='51' r='4' fill={fg} />
          <rect x='0' y='95' width='100' height='55' fill={dots} />
        </>
      )
    case 'arch':
      return (
        <>
          <path d='M22 100 V52 A28 28 0 0 1 78 52 V100Z' fill={fg} />
          <circle cx='50' cy='52' r='12' fill='hsl(var(--canvas))' />
          <rect x='0' y='0' width='100' height='150' fill={dots} opacity='0.3' />
        </>
      )
    case 'stack':
      return (
        <>
          <rect x='18' y='18' width='50' height='50' fill={fg} className='riso-multiply' />
          <circle cx='62' cy='62' r='26' fill='hsl(var(--riso-marigold))' className='riso-multiply' />
          <rect x='18' y='86' width='64' height='4' fill={text} />
        </>
      )
  }
}
