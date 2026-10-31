'use client'

import Link from 'next/link'
import { PointerEvent, useRef } from 'react'
import {
  motion,
  MotionValue,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import { ArrowDown, ArrowRight, Eye, Heart, Smile } from 'lucide-react'
import { BrandVideo } from '@/components/BrandVideo'
import { cn } from '@/lib/utils'
import { PEOPLE, titleById } from './demo-data'
import { Poster } from './Poster'
import { EASE_OUT } from './Reveal'

const line = {
  hidden: { opacity: 0, y: '0.5em', rotate: 2 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: { duration: 1, ease: EASE_OUT, delay: 0.15 + i * 0.12 },
  }),
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, ease: EASE_OUT, delay },
})

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()

  // Pointer parallax: -0.5..0.5 across the hero, smoothed.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 60, damping: 18, mass: 0.6 })
  const sy = useSpring(py, { stiffness: 60, damping: 18, mass: 0.6 })

  const onPointerMove = (e: PointerEvent) => {
    if (reduce || e.pointerType !== 'mouse') return
    const rect = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - rect.left) / rect.width - 0.5)
    py.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  // The art drifts up a little slower than the page as you leave the hero.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const artY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120])

  return (
    <section
      ref={ref}
      onPointerMove={onPointerMove}
      className='relative overflow-hidden px-5 pb-20 pt-28 sm:px-8 sm:pt-36 lg:pb-28'
    >
      <div className='mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-8'>
        <div className='relative z-10 text-center lg:text-left'>
          <motion.p
            {...fadeUp(0)}
            className='text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground'
          >
            Movie night, minus the scrolling
          </motion.p>

          <h1 className='font-display mt-6 text-[clamp(2.6rem,5.2vw,4.4rem)] leading-[0.94] text-foreground'>
            <span className='block overflow-hidden pb-[0.06em]'>
              <motion.span className='block' variants={line} initial='hidden' animate='show' custom={0}>
                Spend less
              </motion.span>
            </span>
            <span className='block overflow-hidden pb-[0.06em]'>
              <motion.span className='block whitespace-nowrap' variants={line} initial='hidden' animate='show' custom={1}>
                time{' '}
                <span className='relative inline-block'>
                  <span className='font-accent text-[1.12em] leading-none'>deciding</span>
                  <Scribble />
                </span>
              </motion.span>
            </span>
            <span className='block overflow-hidden pb-[0.08em]'>
              <motion.span className='block whitespace-nowrap' variants={line} initial='hidden' animate='show' custom={2}>
                what to watch.
              </motion.span>
            </span>
          </h1>

          <motion.p
            {...fadeUp(0.55)}
            className='mx-auto mt-7 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground lg:mx-0'
          >
            Looksee is one shared watchlist for you and everyone you watch with. Save what you
            want to see, swipe on what they add, and when it&apos;s time to watch, hit one big
            button. We&apos;ll pick the thing the whole room actually wants.
          </motion.p>

          <motion.div
            {...fadeUp(0.7)}
            className='mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start'
          >
            <Link
              href='/auth/signup'
              className='group relative inline-flex h-14 items-center gap-2 overflow-hidden rounded-full bg-ink px-7 text-base font-semibold text-canvas shadow-pop transition-transform active:scale-[0.97]'
            >
              <span
                aria-hidden
                className='absolute inset-0 -translate-x-full bg-tomato transition-transform duration-500 ease-out-expo group-hover:translate-x-0'
              />
              <span className='relative'>Start your watchlist</span>
              <ArrowRight
                className='relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-1'
                aria-hidden
              />
            </Link>
            <a
              href='#how'
              className='group inline-flex h-14 items-center gap-2 rounded-full border border-foreground/20 px-6 text-base font-semibold text-foreground transition-colors hover:border-foreground/40 hover:bg-foreground/5'
            >
              See how it works
              <ArrowDown
                className='h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5'
                aria-hidden
              />
            </a>
          </motion.div>

          <motion.div
            {...fadeUp(0.85)}
            className='mt-8 flex items-center justify-center gap-3 text-sm text-muted-foreground lg:justify-start'
          >
            <div className='flex -space-x-2'>
              {(['you', 'sam', 'alex'] as const).map((p) => (
                <span
                  key={p}
                  className='grid h-8 w-8 place-items-center rounded-full border-2 border-canvas text-xs font-bold text-ink'
                  style={{ background: PEOPLE[p].color }}
                >
                  {PEOPLE[p].initial}
                </span>
              ))}
            </div>
            <span>Made for couples, housemates and movie clubs. Free.</span>
          </motion.div>
        </div>

        <motion.div style={{ y: artY }} className='relative mx-auto w-[84%] max-w-[540px] sm:w-full'>
          <HeroArt sx={sx} sy={sy} />
        </motion.div>
      </div>
    </section>
  )
}

/** A hand-drawn underline that draws itself in under "deciding". */
function Scribble() {
  return (
    <svg
      viewBox='0 0 300 30'
      preserveAspectRatio='none'
      aria-hidden
      className='pointer-events-none absolute -bottom-[0.08em] left-[-3%] h-[0.28em] w-[106%] overflow-visible text-tomato'
    >
      <motion.path
        d='M4 18C60 8 120 6 180 10C220 13 262 19 296 12'
        fill='none'
        stroke='currentColor'
        strokeWidth='7'
        strokeLinecap='round'
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: EASE_OUT, delay: 1 }}
      />
      <motion.path
        d='M30 25C100 18 190 18 270 22'
        fill='none'
        stroke='currentColor'
        strokeWidth='4'
        strokeLinecap='round'
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: EASE_OUT, delay: 1.35 }}
      />
    </svg>
  )
}

/** Moves a layer with the pointer, `depth` px at the hero's edges. */
function useDepth(sx: MotionValue<number>, sy: MotionValue<number>, depth: number) {
  const x = useTransform(sx, (v) => v * depth)
  const y = useTransform(sy, (v) => v * depth)
  return { x, y }
}

function HeroArt({ sx, sy }: { sx: MotionValue<number>; sy: MotionValue<number> }) {
  const far = useDepth(sx, sy, -18)
  const mid = useDepth(sx, sy, 14)
  const near = useDepth(sx, sy, 34)

  return (
    <div className='relative aspect-square w-full'>
      {/* Riso ink discs, overprinting where they meet. */}
      <motion.div style={far} className='absolute inset-0'>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.2 }}
          className='riso-multiply absolute right-[2%] top-[4%] h-[46%] w-[46%] rounded-full bg-tomato'
        />
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.32 }}
          className='riso-multiply absolute bottom-[6%] left-[0%] h-[42%] w-[42%] rounded-full bg-cobalt'
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.5 }}
          className='halftone halftone-fade absolute bottom-[2%] right-[4%] h-[38%] w-[38%] rounded-full text-marigold'
        />
        <svg
          viewBox='0 0 100 100'
          aria-hidden
          className='slow-spin absolute left-[6%] top-[8%] hidden h-[20%] w-[20%] text-foreground/70 sm:block'
        >
          <defs>
            <path id='ring' d='M50 50m-36 0a36 36 0 1 1 72 0a36 36 0 1 1 -72 0' />
          </defs>
          <text className='font-display' fontSize='10' fill='currentColor'>
            <textPath href='#ring' textLength='222' lengthAdjust='spacing'>
              WHAT SHOULD WE WATCH? ✦
            </textPath>
          </text>
        </svg>
      </motion.div>

      {/* The mark, in a paper disc the clip dissolves into. */}
      <motion.div style={mid} className='absolute inset-[15%]'>
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.1 }}
          className='relative grid h-full w-full place-items-center rounded-full bg-canvas shadow-modal ring-2 ring-foreground'
        >
          <BrandVideo className='aspect-[720/544] w-[78%]' />
        </motion.div>
      </motion.div>

      {/* Posters and reactions floating in front. */}
      <motion.div style={near} className='pointer-events-none absolute inset-0'>
        <FloatIn delay={0.6} className='absolute -left-[4%] top-[30%] w-[24%]' tilt={-9} bob={-12} duration={6.5}>
          <Poster title={titleById('margate')} />
          <Chip className='-bottom-4 left-1/2 -translate-x-1/2' tone='tomato'>
            <Heart className='h-3.5 w-3.5 fill-current' aria-hidden /> Tonight&apos;s pick
          </Chip>
        </FloatIn>
        <FloatIn delay={0.75} className='absolute right-[-2%] top-[46%] w-[22%]' tilt={8} bob={-9} duration={7.2}>
          <Poster title={titleById('kingfisher')} />
          <Chip className='-left-10 -top-4'>
            <Smile className='h-3.5 w-3.5' aria-hidden /> Sam · Excited
          </Chip>
        </FloatIn>
        <FloatIn delay={0.9} className='absolute left-[40%] top-[-3%] w-[17%]' tilt={5} bob={-7} duration={5.6}>
          <Poster title={titleById('heist')} bare />
          <Chip className='-right-24 top-3'>
            <Eye className='h-3.5 w-3.5' aria-hidden /> Alex · Seen it
          </Chip>
        </FloatIn>
      </motion.div>
    </div>
  )
}

function FloatIn({
  children,
  className,
  delay,
  tilt,
  bob,
  duration,
}: {
  children: React.ReactNode
  className?: string
  delay: number
  tilt: number
  bob: number
  duration: number
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1, ease: EASE_OUT, delay }}
    >
      <div
        className='float-bob relative'
        style={
          {
            '--tilt': `${tilt}deg`,
            '--bob': `${bob}px`,
            '--bob-duration': `${duration}s`,
            '--bob-delay': `${-delay * 3}s`,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </motion.div>
  )
}

function Chip({
  children,
  className,
  tone = 'paper',
}: {
  children: React.ReactNode
  className?: string
  tone?: 'paper' | 'tomato'
}) {
  return (
    <span
      className={cn(
        'absolute inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-pop ring-1 sm:text-xs',
        tone === 'tomato'
          ? 'bg-tomato text-ink ring-ink/20'
          : 'bg-background text-foreground ring-foreground/10',
        className,
      )}
    >
      {children}
    </span>
  )
}
