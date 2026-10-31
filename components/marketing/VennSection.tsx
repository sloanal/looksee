'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PEOPLE, Person, pickFor } from './demo-data'
import { Poster } from './Poster'
import { RatingChip } from './RatingChip'
import { EASE_OUT, Reveal } from './Reveal'

const ORDER: Person[] = ['you', 'sam', 'alex']

const R = 132

// Centres glide on a spring; the radius eases, since a spring would overshoot
// below zero (an invalid radius) as someone leaves the couch.
const CIRCLE_MOTION = {
  type: 'spring',
  stiffness: 90,
  damping: 16,
  r: { duration: 0.6, ease: EASE_OUT },
  opacity: { duration: 0.4 },
} as const

/** Where each circle sits for a given couch, in a 500×460 box. */
function layout(present: Person[]) {
  const pos: Record<Person, { cx: number; cy: number }> = {
    you: { cx: 250, cy: 230 },
    sam: { cx: 250, cy: 230 },
    alex: { cx: 250, cy: 230 },
  }
  if (present.length === 3) {
    pos.you = { cx: 184, cy: 180 }
    pos.sam = { cx: 316, cy: 180 }
    pos.alex = { cx: 250, cy: 296 }
  } else if (present.length === 2) {
    pos[present[0]] = { cx: 186, cy: 230 }
    pos[present[1]] = { cx: 314, cy: 230 }
  }
  // Anyone off the couch shrinks away from where they'd have been.
  if (!present.includes('you')) pos.you = { cx: 150, cy: 150 }
  if (!present.includes('sam')) pos.sam = { cx: 350, cy: 150 }
  if (!present.includes('alex')) pos.alex = { cx: 250, cy: 350 }
  return pos
}

const LABEL_OFFSET: Record<Person, { dx: number; dy: number }> = {
  you: { dx: -78, dy: -70 },
  sam: { dx: 78, dy: -70 },
  alex: { dx: 0, dy: 100 },
}

export function VennSection() {
  const [present, setPresent] = useState<Person[]>(ORDER)
  const diagramRef = useRef<HTMLDivElement>(null)
  const shown = useInView(diagramRef, { once: true, amount: 0.3 })
  // True once the first build-in has played, so later toggles skip its stagger.
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    if (!shown) return
    const id = window.setTimeout(() => setEntered(true), 1600)
    return () => window.clearTimeout(id)
  }, [shown])
  const pos = layout(present)
  const pick = pickFor(present)
  const center = present.reduce(
    (acc, p) => ({ x: acc.x + pos[p].cx / present.length, y: acc.y + pos[p].cy / present.length }),
    { x: 0, y: 0 },
  )

  const toggle = (p: Person) =>
    setPresent((cur) => {
      if (cur.includes(p)) return cur.length === 1 ? cur : cur.filter((x) => x !== p)
      return ORDER.filter((x) => x === p || cur.includes(x))
    })

  return (
    <section id='overlap' className='relative scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28'>
      <div className='mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16'>
        <div>
          <Reveal>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground'>
              The idea
            </p>
            <h2 className='font-display mt-4 text-[clamp(2.4rem,5.5vw,4.2rem)] leading-[0.95]'>
              We find the <span className='font-accent text-[1.1em]'>overlap.</span>
            </h2>
            <p className='mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground'>
              Everyone keeps their own list of what they want to watch. Looksee lays the lists on
              top of each other and heads straight for the middle of the Venn diagram: the titles
              the most people in the room want to see, ranked by how excited you all are.
            </p>
          </Reveal>

          <Reveal delay={0.1} className='mt-9'>
            <p id='couch-label' className='text-sm font-semibold text-foreground'>
              Who&apos;s on the couch tonight? <span className='font-normal text-muted-foreground'>Tap to try it.</span>
            </p>
            <div role='group' aria-labelledby='couch-label' className='mt-3 flex flex-wrap gap-2'>
              {ORDER.map((p) => {
                const on = present.includes(p)
                return (
                  <button
                    key={p}
                    type='button'
                    aria-pressed={on}
                    onClick={() => toggle(p)}
                    className={cn(
                      'inline-flex h-11 items-center gap-2 rounded-full border-2 pl-1.5 pr-4 text-sm font-semibold transition-all duration-300 active:scale-95',
                      on
                        ? 'border-ink bg-ink text-canvas'
                        : 'border-foreground/15 bg-background text-muted-foreground hover:border-foreground/30',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-ink transition-opacity',
                        !on && 'opacity-40',
                      )}
                      style={{ background: PEOPLE[p].color }}
                    >
                      {on ? <Check className='h-3.5 w-3.5' strokeWidth={3} aria-hidden /> : PEOPLE[p].initial}
                    </span>
                    {PEOPLE[p].name}
                  </button>
                )
              })}
            </div>
          </Reveal>

          <Reveal delay={0.18} className='mt-6'>
            <div
              aria-live='polite'
              className='relative min-h-[148px] overflow-hidden rounded-2xl border border-foreground/10 bg-background p-4 shadow-card'
            >
              <AnimatePresence mode='wait' initial={false}>
                {pick && (
                  <motion.div
                    key={pick.title.id + present.join()}
                    initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                    transition={{ duration: 0.45, ease: EASE_OUT }}
                    className='flex gap-4'
                  >
                    <Poster title={pick.title} bare className='w-[76px] flex-shrink-0' />
                    <div className='min-w-0'>
                      <p className='text-[11px] font-bold uppercase tracking-[0.16em] text-tomato'>
                        {present.length === 1 ? 'Your pick' : 'Tonight’s pick'}
                      </p>
                      <p className='font-display mt-1 text-xl leading-tight'>{pick.title.title}</p>
                      <p className='mt-0.5 text-xs text-muted-foreground'>
                        {pick.title.kind} · {pick.title.genre} ·{' '}
                        {present.length === 1
                          ? 'top of your list'
                          : `${pick.interested.length} of ${present.length} want to watch`}
                      </p>
                      <div className='mt-2.5 flex flex-wrap gap-1.5'>
                        {present.map((p) => (
                          <RatingChip key={p} person={p} rating={pick.title.ratings[p]} />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.05} y={40} className='relative'>
          {/*
            The entrance is triggered from this HTML wrapper and only animates
            SVG attributes (r, cx, cy, x, y). WebKit is unreliable at observing
            SVG children for scroll-into-view and at CSS-transforming them,
            which left the circles invisible on iOS Safari.
          */}
          <div ref={diagramRef} className='relative mx-auto aspect-[500/460] w-full max-w-[560px]'>
            <svg viewBox='0 0 500 460' className='h-full w-full overflow-visible' role='img' aria-label='A Venn diagram of everyone’s watchlists, with tonight’s pick in the middle'>
              <defs>
                <pattern id='venn-dots' width='6' height='6' patternUnits='userSpaceOnUse'>
                  <circle cx='3' cy='3' r='1.1' fill='hsl(var(--ink))' opacity='0.18' />
                </pattern>
              </defs>
              {ORDER.map((p, i) => {
                const visible = shown && present.includes(p)
                const r = visible ? R : 0
                // Stagger only the first build-in; toggles respond at once.
                const delay = entered ? 0 : 0.15 + i * 0.14
                const circleMotion = {
                  ...CIRCLE_MOTION,
                  r: { ...CIRCLE_MOTION.r, duration: entered ? 0.6 : 1.1, delay },
                  opacity: { ...CIRCLE_MOTION.opacity, delay },
                }
                const labelX = pos[p].cx + LABEL_OFFSET[p].dx * (present.length === 1 ? 0 : 1)
                const labelY = pos[p].cy + (present.length === 1 ? -R - 18 : LABEL_OFFSET[p].dy)
                return (
                  <g key={p}>
                    <motion.circle
                      initial={false}
                      cx={pos[p].cx}
                      cy={pos[p].cy}
                      r={0}
                      animate={{ cx: pos[p].cx, cy: pos[p].cy, r, opacity: visible ? 1 : 0 }}
                      transition={circleMotion}
                      fill={PEOPLE[p].color}
                      style={{ mixBlendMode: 'multiply' }}
                    />
                    <motion.circle
                      initial={false}
                      cx={pos[p].cx}
                      cy={pos[p].cy}
                      r={0}
                      animate={{ cx: pos[p].cx, cy: pos[p].cy, r, opacity: visible ? 1 : 0 }}
                      transition={circleMotion}
                      fill='url(#venn-dots)'
                    />
                    <motion.text
                      initial={false}
                      x={labelX}
                      y={labelY}
                      opacity={0}
                      animate={{ attrX: labelX, attrY: labelY, opacity: visible ? 1 : 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 90,
                        damping: 18,
                        opacity: { duration: 0.5, delay: entered ? 0 : delay + 0.35 },
                      }}
                      textAnchor='middle'
                      className='font-display'
                      fontSize='22'
                      fill='hsl(var(--ink))'
                    >
                      {PEOPLE[p].name}
                    </motion.text>
                  </g>
                )
              })}

              {/* The play button lives where everything overlaps. */}
              <motion.g
                initial={false}
                opacity={0}
                animate={{ x: center.x, y: center.y, opacity: shown ? 1 : 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 90,
                  damping: 16,
                  opacity: { duration: 0.5, delay: entered ? 0 : 0.7 },
                }}
              >
                <motion.circle
                  r={30}
                  initial={{ r: 30, opacity: 0.9 }}
                  fill='none'
                  stroke='hsl(var(--canvas))'
                  strokeWidth='2'
                  animate={{ r: [30, 46], opacity: [0.9, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                />
                <circle r='30' fill='hsl(var(--ink))' stroke='hsl(var(--canvas))' strokeWidth='3' />
                <path d='M-8 -12 L14 0 L-8 12Z' fill='hsl(var(--canvas))' />
              </motion.g>
            </svg>
          </div>
          <ul className='mx-auto mt-6 grid max-w-md gap-2 text-sm text-muted-foreground sm:grid-cols-3 sm:text-center'>
            {['Most people interested wins', 'Then whoever’s most excited', 'Seen it? Out of the running'].map(
              (t) => (
                <li key={t} className='flex items-center gap-2 sm:flex-col sm:gap-1.5'>
                  <Check className='h-4 w-4 flex-shrink-0 text-foreground' aria-hidden />
                  {t}
                </li>
              ),
            )}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
