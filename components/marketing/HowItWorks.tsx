import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AddDemo } from './AddDemo'
import { Reveal } from './Reveal'
import { SwipeDemo } from './SwipeDemo'
import { WatchDemo } from './WatchDemo'

export function HowItWorks() {
  return (
    <section id='how' className='relative scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28'>
      <div className='mx-auto max-w-6xl'>
        <Reveal className='mx-auto max-w-2xl text-center'>
          <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground'>
            How it works
          </p>
          <h2 className='font-display mt-4 text-[clamp(2.4rem,5.5vw,4.2rem)] leading-[0.95]'>
            Your wish list, <span className='font-accent text-[1.1em]'>then</span> your watch list.
          </h2>
          <p className='mt-6 text-lg leading-relaxed text-muted-foreground'>
            Use Looksee like a running list of everything you want to watch. The deciding happens
            later, in one tap.
          </p>
        </Reveal>

        <div className='mt-20 space-y-24 sm:mt-24 sm:space-y-32'>
          <Step
            n='01'
            accent='bg-marigold'
            title='Save anything you want to watch.'
            body={
              <>
                Search any movie or show and add it in a tap, or bring your whole Letterboxd
                watchlist over in one go. Put it in a room (your household, your partner, the
                Tuesday-night crew) and everyone there can see it.
              </>
            }
            demo={<AddDemo />}
          />
          <Step
            n='02'
            accent='bg-cobalt'
            flip
            title='Swipe to say how excited you are.'
            body={
              <>
                Right for excited, left for not, tap for meh. When someone in your room adds
                something new, it lands in your queue, ready to swipe. Give this deck a try.
              </>
            }
            demo={<SwipeDemo />}
          />
          <Step
            n='03'
            accent='bg-tomato'
            title='Hit the big fat Watch button.'
            body={
              <>
                Pick who&apos;s on the couch. Looksee ranks your shared list by how many of you
                want to see each title, then by how excited you are, skips anything already seen,
                and hands you the winner. No more scrolling.
              </>
            }
            demo={<WatchDemo />}
          />
        </div>
      </div>
    </section>
  )
}

function Step({
  n,
  title,
  body,
  demo,
  accent,
  flip = false,
}: {
  n: string
  title: string
  body: ReactNode
  demo: ReactNode
  accent: string
  flip?: boolean
}) {
  return (
    <div className='grid items-center gap-12 lg:grid-cols-2 lg:gap-20'>
      <Reveal className={cn('relative', flip && 'lg:order-2')}>
        <div className='flex items-center gap-4'>
          <span className={cn('font-display grid h-14 w-14 place-items-center rounded-full text-lg text-ink ring-2 ring-ink', accent)}>
            {n}
          </span>
          <span className='h-px flex-1 bg-foreground/15' />
        </div>
        <h3 className='font-display mt-7 text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1]'>{title}</h3>
        <p className='mt-5 max-w-md text-lg leading-relaxed text-muted-foreground'>{body}</p>
      </Reveal>
      <Reveal delay={0.12} y={40} className={cn('relative', flip && 'lg:order-1')}>
        <div aria-hidden className={cn('riso-multiply absolute left-1/2 top-1/2 -z-10 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35 blur-2xl', accent)} />
        {demo}
      </Reveal>
    </div>
  )
}
