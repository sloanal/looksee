'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PEOPLE, Person, titleById } from './demo-data'
import { Poster } from './Poster'
import { EASE_OUT, Reveal } from './Reveal'

/** Your solo list, with who else is waiting on each (the app's isWaitingToWatch rule). */
const ROWS = ['static', 'honey', 'nightbus', 'heist', 'planets'].map((id) => {
  const title = titleById(id)
  const waiting = (['sam', 'alex'] as Person[]).filter((p) => title.ratings[p] === 5)
  return { title, waiting }
})

export function TroubleSection() {
  const [on, setOn] = useState(false)
  const touched = useRef(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const inView = useInView(cardRef, { amount: 0.7, once: true })

  // Flip the switch for them once the card is in view, so the effect plays out.
  useEffect(() => {
    if (!inView) return
    const id = window.setTimeout(() => {
      if (!touched.current) setOn(true)
    }, 1100)
    return () => window.clearTimeout(id)
  }, [inView])

  const visible = ROWS.filter((r) => !on || r.waiting.length === 0)

  return (
    <section id='solo' className='on-ink relative scroll-mt-20 overflow-hidden bg-ink px-5 py-24 text-canvas sm:px-8 sm:py-32'>
      {/* Halftone sky and a tomato sun, for a bit of drama. */}
      <div aria-hidden className='halftone halftone-fade absolute -left-20 -top-20 h-[460px] w-[460px] rounded-full text-canvas/20' />
      <div aria-hidden className='absolute -bottom-40 -right-32 h-[420px] w-[420px] rounded-full bg-tomato/90' />

      <div className='relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2 lg:gap-20'>
        <Reveal>
          <p className='text-xs font-semibold uppercase tracking-[0.18em] text-canvas/60'>Watching solo?</p>
          <h2 className='font-display mt-4 text-[clamp(2.4rem,5.5vw,4.2rem)] leading-[0.95]'>
            Don&apos;t get me <span className='font-accent fill-text-current text-[1.1em] text-marigold'>in trouble.</span>
          </h2>
          <p className='mt-6 max-w-lg text-lg leading-relaxed text-canvas/75'>
            Got the place to yourself? Flip this on and Looksee only suggests things nobody else
            is waiting to see: stuff they&apos;ve already watched, aren&apos;t fussed about, or
            haven&apos;t rated. Enjoy your night in, and skip the &ldquo;you watched it{' '}
            <em>without me?</em>&rdquo; conversation.
          </p>
        </Reveal>

        <Reveal delay={0.1} y={40}>
          <div ref={cardRef} className='mx-auto max-w-md rounded-3xl bg-background p-5 text-foreground shadow-modal sm:p-6'>
            <label className='flex cursor-pointer items-start gap-4'>
              <span className='min-w-0 flex-1'>
                <span className='flex items-center gap-2 text-sm font-semibold'>
                  <ShieldCheck className='h-4 w-4' aria-hidden />
                  Don&apos;t get me in trouble
                </span>
                <span className='mt-0.5 block text-xs text-muted-foreground'>
                  Hide anything someone else is excited to watch.
                </span>
              </span>
              <input
                type='checkbox'
                role='switch'
                checked={on}
                onChange={(e) => {
                  touched.current = true
                  setOn(e.target.checked)
                }}
                className='peer sr-only'
              />
              <span
                aria-hidden
                className={cn(
                  'relative mt-0.5 h-7 w-12 flex-shrink-0 rounded-full transition-colors duration-300 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                  on ? 'bg-ink' : 'bg-input',
                )}
              >
                <motion.span
                  className='absolute top-1 h-5 w-5 rounded-full bg-canvas shadow-sm'
                  animate={{ left: on ? 24 : 4 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </span>
            </label>

            <div className='mt-5 border-t border-border pt-4'>
              <p className='mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground'>
                Your picks · {visible.length} {visible.length === 1 ? 'title' : 'titles'}
              </p>
              <ul className='space-y-1'>
                <AnimatePresence initial={false}>
                  {visible.map(({ title, waiting }) => (
                    <motion.li
                      key={title.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0, x: 40 }}
                      transition={{ duration: 0.45, ease: EASE_OUT }}
                      className='overflow-hidden'
                    >
                      <div className='flex items-center gap-3 py-1.5'>
                        <Poster title={title} bare className='w-9 flex-shrink-0 rounded-sm' />
                        <div className='min-w-0 flex-1'>
                          <p className='truncate text-sm font-semibold'>{title.title}</p>
                          <p className='text-xs text-muted-foreground'>{title.kind} · {title.genre}</p>
                        </div>
                        {waiting.length > 0
                          ? (
                            <span className='flex-shrink-0 rounded-full bg-tomato/15 px-2 py-0.5 text-[11px] font-semibold text-[hsl(8_70%_38%)]'>
                              {waiting.map((p) => PEOPLE[p].name).join(' & ')} is excited
                            </span>
                          )
                          : (
                            <span className='flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground'>
                              All clear
                            </span>
                          )}
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
