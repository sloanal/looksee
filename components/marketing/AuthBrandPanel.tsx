'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BrandVideo } from '@/components/BrandVideo'
import { titleById } from './demo-data'
import { Logo } from './Logo'
import { Poster } from './Poster'
import { EASE_OUT } from './Reveal'

const LINES = [
  'One shared list for everyone you watch with.',
  'Swipe right for excited, left for not.',
  'One big button picks for the whole room.',
  'Watching solo? We’ll keep you out of trouble.',
]

/** The ink panel beside the sign in / sign up forms on wide screens. */
export function AuthBrandPanel() {
  const [i, setI] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => setI((n) => (n + 1) % LINES.length), 3800)
    return () => window.clearInterval(id)
  }, [reduce])

  return (
    <aside className='on-ink sticky top-3 m-3 hidden h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-[2rem] bg-ink p-10 text-canvas lg:flex'>
      <div aria-hidden className='absolute -right-24 -top-24 h-80 w-80 rounded-full bg-tomato' />
      <div aria-hidden className='absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-cobalt' />
      <div aria-hidden className='absolute bottom-40 right-16 h-24 w-24 rounded-full bg-marigold' />
      <div aria-hidden className='halftone halftone-fade absolute left-10 top-24 h-64 w-64 rounded-full text-canvas/15' />

      <Logo inverted className='relative self-start text-canvas focus-visible:ring-offset-ink' />

      <div className='relative flex flex-1 items-center justify-center'>
        <div className='relative aspect-square w-full max-w-[400px]'>
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, ease: EASE_OUT }}
            className='absolute inset-[8%] grid place-items-center rounded-full bg-canvas shadow-modal'
          >
            <BrandVideo className='aspect-[720/544] w-[78%]' />
          </motion.div>
          <Floating className='-left-[4%] top-[8%] w-[24%]' tilt={-10} delay={0.3}>
            <Poster title={titleById('margate')} bare />
          </Floating>
          <Floating className='-right-[2%] bottom-[10%] w-[26%]' tilt={9} delay={0.45}>
            <Poster title={titleById('kingfisher')} bare />
          </Floating>
          <Floating className='bottom-[2%] left-[6%] w-[18%]' tilt={4} delay={0.6}>
            <Poster title={titleById('static')} bare />
          </Floating>
        </div>
      </div>

      <div className='relative h-24'>
        <AnimatePresence mode='wait'>
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className='font-display max-w-md text-3xl leading-[1.05] text-canvas'
          >
            {LINES[i]}
          </motion.p>
        </AnimatePresence>
        <div className='mt-4 flex gap-1.5' aria-hidden>
          {LINES.map((_, n) => (
            <span
              key={n}
              className={`h-1 rounded-full transition-all duration-500 ${n === i ? 'w-8 bg-marigold' : 'w-3 bg-canvas/30'}`}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

function Floating({
  children,
  className,
  tilt,
  delay,
}: {
  children: React.ReactNode
  className: string
  tilt: number
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: EASE_OUT, delay }}
      className={`absolute ${className}`}
    >
      <div
        className='float-bob'
        style={{ '--tilt': `${tilt}deg`, '--bob-duration': `${5 + delay * 4}s` } as React.CSSProperties}
      >
        {children}
      </div>
    </motion.div>
  )
}
