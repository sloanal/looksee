'use client'

import { useEffect, useRef, useState } from 'react'
import {
  animate,
  AnimatePresence,
  motion,
  PanInfo,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion'
import { ArrowLeft, ArrowRight, ArrowUp, Frown, Meh, Smile } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TITLES } from './demo-data'
import { Poster } from './Poster'

type Dir = 'left' | 'up' | 'right'

const DECK = [TITLES[5], TITLES[3], TITLES[7], TITLES[0], TITLES[4], TITLES[1], TITLES[6], TITLES[2]]

const LABEL: Record<Dir, string> = { left: 'Not excited', up: 'Neutral', right: 'Excited' }

/**
 * A real, draggable deck: swipe right for excited, left for not, or use the
 * keys underneath (the same key the app's New queue has).
 */
export function SwipeDemo() {
  const [index, setIndex] = useState(0)
  const [pending, setPending] = useState<Dir | null>(null)
  const [last, setLast] = useState<{ dir: Dir; title: string; n: number } | null>(null)
  const [touched, setTouched] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.6 })
  const reduce = useReducedMotion()

  const done = (dir: Dir) => {
    setLast({ dir, title: DECK[index % DECK.length].title, n: index })
    setIndex((i) => i + 1)
    setPending(null)
  }

  const fire = (dir: Dir) => {
    if (pending) return
    setTouched(true)
    setPending(dir)
  }

  return (
    <div ref={ref} className='mx-auto w-full max-w-sm'>
      <div className='relative mx-auto aspect-[2/3] w-[64%] max-w-[230px]'>
        {[2, 1].map((offset) => {
          const t = DECK[(index + offset) % DECK.length]
          return (
            <motion.div
              key={index + offset}
              className='absolute inset-0'
              initial={false}
              animate={{ scale: 1 - offset * 0.05, y: offset * 14, rotate: offset % 2 ? 3 : -3 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            >
              <Poster title={t} className='h-full w-full rounded-xl' />
            </motion.div>
          )
        })}
        <TopCard
          key={index}
          title={DECK[index % DECK.length]}
          pending={pending}
          hint={inView && !touched && !reduce}
          onThrow={(dir) => {
            setTouched(true)
            setPending(dir)
          }}
          onDone={done}
        />
      </div>

      <div className='mt-10 h-6 text-center text-sm' aria-live='polite'>
        <AnimatePresence mode='wait'>
          {last && (
            <motion.p
              key={last.n}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className='text-muted-foreground'
            >
              <span className='font-semibold text-foreground'>{LABEL[last.dir]}</span> about {last.title}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className='mt-3 flex gap-2' role='group' aria-label='Rate the title in front'>
        <Key icon={Frown} label='Not excited' hint='swipe left' arrow={ArrowLeft} onClick={() => fire('left')} active={pending === 'left'} />
        <Key icon={Meh} label='Neutral' hint='tap' arrow={ArrowUp} onClick={() => fire('up')} active={pending === 'up'} />
        <Key icon={Smile} label='Excited' hint='swipe right' arrow={ArrowRight} onClick={() => fire('right')} active={pending === 'right'} />
      </div>
    </div>
  )
}

function TopCard({
  title,
  pending,
  hint,
  onThrow,
  onDone,
}: {
  title: (typeof TITLES)[number]
  pending: Dir | null
  hint: boolean
  onThrow: (dir: Dir) => void
  onDone: (dir: Dir) => void
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-220, 220], [-18, 18])
  const yes = useTransform(x, [20, 110], [0, 1])
  const no = useTransform(x, [-110, -20], [1, 0])
  const meh = useTransform(y, [-110, -20], [1, 0])
  const thrown = useRef(false)

  const fly = (dir: Dir) => {
    if (thrown.current) return
    thrown.current = true
    const opts = { duration: 0.45, ease: [0.32, 0, 0.67, 0] as const }
    if (dir === 'up') {
      animate(y, -520, opts).then(() => onDone(dir))
    } else {
      animate(x, dir === 'right' ? 520 : -520, opts).then(() => onDone(dir))
      animate(y, 40, opts)
    }
  }

  useEffect(() => {
    if (pending) fly(pending)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  // A little nudge right then left, so it's obvious the card moves.
  useEffect(() => {
    if (!hint) return
    const id = window.setTimeout(async () => {
      if (thrown.current) return
      await animate(x, 60, { duration: 0.45, ease: 'easeOut' })
      await animate(x, -40, { duration: 0.5, ease: 'easeInOut' })
      await animate(x, 0, { type: 'spring', stiffness: 300, damping: 20 })
    }, 900)
    return () => window.clearTimeout(id)
  }, [hint, x])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info
    if (offset.x > 100 || velocity.x > 600) onThrow('right')
    else if (offset.x < -100 || velocity.x < -600) onThrow('left')
    else if (offset.y < -110 || velocity.y < -700) onThrow('up')
    else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 28 })
      animate(y, 0, { type: 'spring', stiffness: 400, damping: 28 })
    }
  }

  return (
    <motion.div
      className='absolute inset-0 z-10 cursor-grab touch-none active:cursor-grabbing'
      style={{ x, y, rotate }}
      drag
      dragMomentum={false}
      onDragEnd={onDragEnd}
      initial={{ scale: 0.95, y: 14 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      whileTap={{ scale: 1.02 }}
      aria-label={`${title.title}. Drag right if excited, left if not.`}
    >
      <Poster title={title} className='pointer-events-none h-full w-full rounded-xl shadow-modal' />
      <Stamp style={{ opacity: yes }} className='left-3 top-4 -rotate-12 border-[hsl(140_55%_38%)] text-[hsl(140_55%_32%)]'>
        Excited
      </Stamp>
      <Stamp style={{ opacity: no }} className='right-3 top-4 rotate-12 border-tomato text-tomato'>
        Nope
      </Stamp>
      <Stamp style={{ opacity: meh }} className='bottom-14 left-1/2 -translate-x-1/2 border-ink text-ink'>
        Meh
      </Stamp>
    </motion.div>
  )
}

function Stamp({ children, className, style }: { children: React.ReactNode; className?: string; style: object }) {
  return (
    <motion.span
      style={style}
      className={cn(
        'font-display pointer-events-none absolute rounded-md border-[3px] bg-canvas/90 px-2 py-0.5 text-lg uppercase',
        className,
      )}
    >
      {children}
    </motion.span>
  )
}

function Key({
  icon: Icon,
  arrow: Arrow,
  label,
  hint,
  onClick,
  active,
}: {
  icon: typeof Smile
  arrow: typeof ArrowLeft
  label: string
  hint: string
  onClick: () => void
  active: boolean
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-label={`${label} (${hint})`}
      className={cn(
        'flex min-h-[56px] flex-1 flex-col items-center justify-center rounded-xl border bg-background px-1.5 py-1.5 transition-all duration-200 hover:bg-accent active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-foreground bg-accent' : 'border-input',
      )}
    >
      <span className='flex items-center gap-1 text-xs font-semibold text-foreground'>
        <Icon className='h-4 w-4' aria-hidden />
        {label}
      </span>
      <span className='mt-0.5 flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground'>
        <Arrow className='h-2.5 w-2.5' aria-hidden />
        {hint}
      </span>
    </button>
  )
}
