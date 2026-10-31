'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Play, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PEOPLE, Person, pickFor, TITLES } from './demo-data'
import { Poster } from './Poster'
import { RatingChip } from './RatingChip'
import { EASE_OUT } from './Reveal'

const COUCH: Person[] = ['you', 'sam', 'alex']

type Phase = 'idle' | 'rolling' | 'picked'

/** The big fat Watch button: press it, the reel spins, the room's pick lands. */
export function WatchDemo() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [reel, setReel] = useState(0)
  const timers = useRef<number[]>([])
  const reduce = useReducedMotion()
  const pick = pickFor(COUCH)!

  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  const press = () => {
    if (phase === 'rolling') return
    if (reduce) {
      setPhase('picked')
      return
    }
    setPhase('rolling')
    // Flick through posters, slowing down like a reel coming to rest.
    let elapsed = 0
    for (let i = 0; i < 16; i++) {
      elapsed += 50 + i * i * 1.6
      timers.current.push(window.setTimeout(() => setReel((r) => r + 1), elapsed))
    }
    timers.current.push(window.setTimeout(() => setPhase('picked'), elapsed + 260))
  }

  const reelTitle = TITLES[reel % TITLES.length]

  return (
    <div className='mx-auto w-full max-w-md'>
      <div className='relative overflow-hidden rounded-3xl border border-foreground/10 bg-background p-5 shadow-pop sm:p-6'>
        <div className='flex items-center justify-between'>
          <p className='text-sm font-semibold text-foreground'>Who&apos;s watching?</p>
          <div className='flex -space-x-1.5'>
            {COUCH.map((p) => (
              <span
                key={p}
                className='grid h-7 w-7 place-items-center rounded-full border-2 border-background text-[11px] font-bold text-ink'
                style={{ background: PEOPLE[p].color }}
                title={PEOPLE[p].name}
              >
                {PEOPLE[p].initial}
              </span>
            ))}
          </div>
        </div>

        <div className='relative mt-5 grid min-h-[260px] place-items-center'>
          <AnimatePresence mode='wait'>
            {phase === 'idle' && (
              <motion.div
                key='idle'
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.25 }}
                className='flex flex-col items-center'
              >
                <BigButton onClick={press} />
                <p className='mt-5 text-sm text-muted-foreground'>Go on, press it.</p>
              </motion.div>
            )}

            {phase === 'rolling' && (
              <motion.div
                key='rolling'
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className='flex flex-col items-center'
              >
                <div className='relative h-[180px] w-[120px]'>
                  <Poster key={reel} title={reelTitle} className='absolute inset-0 h-full w-full rounded-lg' />
                </div>
                <p className='mt-4 text-sm font-medium text-muted-foreground'>Comparing three lists…</p>
              </motion.div>
            )}

            {phase === 'picked' && (
              <motion.div
                key='picked'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className='flex w-full flex-col items-center text-center'
              >
                <Burst />
                <motion.div
                  initial={{ scale: 0.6, rotate: -8 }}
                  animate={{ scale: 1, rotate: -2 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                  className='relative w-[120px]'
                >
                  <Poster title={pick.title} className='rounded-lg shadow-modal' />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.2 }}
                >
                  <p className='mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-tomato'>
                    Tonight&apos;s pick
                  </p>
                  <p className='font-display mt-1 text-2xl leading-tight'>{pick.title.title}</p>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    {pick.interested.length} of {COUCH.length} want to watch
                  </p>
                  <div className='mt-3 flex flex-wrap justify-center gap-1.5'>
                    {COUCH.map((p) => (
                      <RatingChip key={p} person={p} rating={pick.title.ratings[p]} />
                    ))}
                  </div>
                  <button
                    type='button'
                    onClick={() => setPhase('idle')}
                    className='mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
                  >
                    <RotateCcw className='h-3.5 w-3.5' aria-hidden /> Press it again
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function BigButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type='button'
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      className='group relative grid h-40 w-40 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-4'
    >
      {/* Rings pulsing outward, asking to be pressed. */}
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className='absolute inset-0 rounded-full border-2 border-tomato'
          animate={{ scale: [1, 1.45], opacity: [0.7, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, delay: i * 1.1, ease: 'easeOut' }}
        />
      ))}
      <span aria-hidden className='absolute inset-0 translate-y-1.5 rounded-full bg-tomato' />
      <span className='relative grid h-full w-full place-items-center rounded-full bg-ink text-canvas shadow-modal transition-transform group-active:translate-y-1'>
        <span className='flex flex-col items-center gap-1.5'>
          <Play className='h-9 w-9 translate-x-0.5 fill-current' aria-hidden />
          <span className='font-display text-xl uppercase tracking-wide'>Watch</span>
        </span>
      </span>
    </motion.button>
  )
}

/** Riso confetti: a ring of ink dots thrown out from the pick. */
function Burst() {
  const dots = Array.from({ length: 14 }, (_, i) => i)
  const colors = ['bg-tomato', 'bg-marigold', 'bg-cobalt', 'bg-ink']
  return (
    <div aria-hidden className='pointer-events-none absolute left-1/2 top-[90px]'>
      {dots.map((i) => {
        const angle = (i / dots.length) * Math.PI * 2
        const dist = 110 + (i % 3) * 22
        return (
          <motion.span
            key={i}
            className={cn('absolute h-2.5 w-2.5 rounded-full', colors[i % colors.length], i % 4 === 1 && 'h-3.5 w-3.5 rounded-sm')}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist * 0.8, scale: [0, 1.2, 0.8], opacity: [1, 1, 0], rotate: 180 }}
            transition={{ duration: 1.1, ease: EASE_OUT }}
          />
        )
      })}
    </div>
  )
}
