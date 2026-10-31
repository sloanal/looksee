'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { Check, Plus, Search, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { titleById } from './demo-data'
import { Poster } from './Poster'
import { EASE_OUT } from './Reveal'

const SCRIPT = [
  { query: 'kingfisher', id: 'kingfisher' },
  { query: 'salt & hon', id: 'honey' },
  { query: 'night bus', id: 'nightbus' },
]

type Phase = 'typing' | 'results' | 'added'

/** A search box that types, finds, and adds on a loop while it's on screen. */
export function AddDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.5 })
  const reduce = useReducedMotion()
  const [round, setRound] = useState(0)
  const [typed, setTyped] = useState(reduce ? SCRIPT[0].query : '')
  const [phase, setPhase] = useState<Phase>(reduce ? 'added' : 'typing')
  const step = SCRIPT[round % SCRIPT.length]
  const title = titleById(step.id)

  useEffect(() => {
    if (!inView || reduce) return
    let t: number
    if (phase === 'typing') {
      if (typed.length < step.query.length) {
        t = window.setTimeout(() => setTyped(step.query.slice(0, typed.length + 1)), 70 + Math.random() * 70)
      } else {
        t = window.setTimeout(() => setPhase('results'), 350)
      }
    } else if (phase === 'results') {
      t = window.setTimeout(() => setPhase('added'), 1300)
    } else {
      t = window.setTimeout(() => {
        setRound((r) => r + 1)
        setTyped('')
        setPhase('typing')
      }, 2000)
    }
    return () => window.clearTimeout(t)
  }, [inView, reduce, phase, typed, step.query])

  return (
    <div ref={ref} className='relative mx-auto w-full max-w-md'>
      <div className='rounded-3xl border border-foreground/10 bg-background p-4 shadow-pop sm:p-5'>
        <div className='flex h-12 items-center gap-2.5 rounded-xl border border-input bg-background px-3.5 shadow-sm'>
          <Search className='h-4 w-4 text-muted-foreground' aria-hidden />
          <span className='text-[15px] text-foreground'>
            {typed}
            <span className={cn('ml-px inline-block h-4 w-[2px] translate-y-0.5 bg-foreground', phase === 'typing' ? 'animate-pulse' : 'opacity-0')} />
          </span>
          {!typed && <span className='text-[15px] text-muted-foreground/65'>Search movies &amp; shows</span>}
        </div>

        <div className='mt-3 min-h-[188px]'>
          <AnimatePresence mode='wait'>
            {phase !== 'typing' && (
              <motion.div
                key={round}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className='space-y-2'
              >
                <div className='flex items-center gap-3 rounded-xl border border-foreground/10 p-2.5'>
                  <Poster title={title} bare className='w-12 flex-shrink-0 rounded' />
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-semibold text-foreground'>{title.title}</p>
                    <p className='text-xs text-muted-foreground'>
                      {title.year} · {title.kind} · {title.genre}
                    </p>
                  </div>
                  <motion.span
                    animate={phase === 'added' ? { scale: [1, 1.25, 1] } : {}}
                    transition={{ duration: 0.4 }}
                    className={cn(
                      'grid h-9 w-9 flex-shrink-0 place-items-center rounded-full transition-colors duration-300',
                      phase === 'added' ? 'bg-ink text-canvas' : 'border border-input text-foreground',
                    )}
                  >
                    {phase === 'added'
                      ? <Check className='h-4 w-4' strokeWidth={3} aria-hidden />
                      : <Plus className='h-4 w-4' aria-hidden />}
                  </motion.span>
                </div>
                {[0, 1].map((i) => (
                  <div key={i} className='flex items-center gap-3 rounded-xl p-2.5 opacity-50'>
                    <div className='h-[72px] w-12 rounded bg-muted' />
                    <div className='flex-1 space-y-1.5'>
                      <div className='h-2.5 w-2/3 rounded-full bg-muted' />
                      <div className='h-2 w-1/3 rounded-full bg-muted' />
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* The toast the app shows after an add. */}
      <AnimatePresence>
        {phase === 'added' && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className='absolute -bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-sm font-semibold text-canvas shadow-modal'
          >
            <Check className='h-4 w-4 text-marigold' strokeWidth={3} aria-hidden />
            Added to Home &amp; Movie Club
          </motion.div>
        )}
      </AnimatePresence>

      <div className='float-bob absolute -right-3 -top-5 hidden rotate-6 items-center gap-1.5 rounded-full border-2 border-ink bg-marigold px-3 py-1.5 text-xs font-bold text-ink shadow-pop sm:flex [--tilt:6deg]'>
        <Upload className='h-3.5 w-3.5' aria-hidden />
        Letterboxd import
      </div>
    </div>
  )
}
