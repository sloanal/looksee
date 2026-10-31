import { cn } from '@/lib/utils'

const LINES = [
  '“What do you want to watch?”',
  '“I dunno, what do you want to watch?”',
  '“Something good.”',
  '“Seen it.”',
  '“Not in the mood for that.”',
  '47 minutes of scrolling later…',
]

const TAGS = [
  'Shared watchlists',
  'Swipe to rate',
  'One big Watch button',
  'Letterboxd import',
  'Don’t get me in trouble',
  'Rooms for every crew',
]

/** Two crossed tapes of type: the endless "what do you want to watch" loop, and the fix. */
export function Marquee() {
  return (
    <section aria-label='Sound familiar?' className='relative py-16 sm:py-24'>
      <div className='relative -mx-4'>
        <Tape items={TAGS} className='absolute inset-x-0 top-1/2 -translate-y-1/2 rotate-[3.2deg] bg-marigold text-ink' reverse dim />
        <Tape items={LINES} className='relative -rotate-[2.4deg] bg-ink text-canvas shadow-modal' />
      </div>
    </section>
  )
}

function Tape({
  items,
  className,
  reverse = false,
  dim = false,
}: {
  items: string[]
  className?: string
  reverse?: boolean
  dim?: boolean
}) {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className='flex shrink-0 items-center'>
      {items.map((item) => (
        <li key={item} className='flex items-center'>
          <span
            className={cn(
              'whitespace-nowrap px-6',
              dim
                ? 'font-display text-sm uppercase tracking-[0.04em] sm:text-base'
                : 'font-display text-2xl sm:text-4xl',
            )}
          >
            {item}
          </span>
          <span aria-hidden className={cn('text-xl', dim ? 'text-ink/50' : 'text-tomato')}>
            ✦
          </span>
        </li>
      ))}
    </ul>
  )

  return (
    <div className={cn('marquee overflow-hidden', dim ? 'py-2.5' : 'py-5 sm:py-6', className)}>
      <div
        className='marquee-track flex w-max'
        style={
          {
            '--marquee-duration': dim ? '46s' : '40s',
            animationDirection: reverse ? 'reverse' : 'normal',
          } as React.CSSProperties
        }
      >
        {row(false)}
        {row(true)}
      </div>
    </div>
  )
}
