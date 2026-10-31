'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Bell, Eye, FileSpreadsheet, Heart, MonitorPlay, Smartphone, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LogoMark } from './Logo'
import { TITLES } from './demo-data'
import { Poster } from './Poster'
import { EASE_OUT, Reveal } from './Reveal'

export function FeatureGrid() {
  return (
    <section id='features' className='relative scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28'>
      <div className='mx-auto max-w-6xl'>
        <Reveal className='max-w-2xl'>
          <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground'>
            The good bits
          </p>
          <h2 className='font-display mt-4 text-[clamp(2.4rem,5.5vw,4.2rem)] leading-[0.95]'>
            Everything movie night <span className='font-accent text-[1.1em]'>needs.</span>
          </h2>
        </Reveal>

        <div className='mt-14 grid gap-4 md:grid-cols-3'>
          <Card
            className='md:col-span-2'
            icon={Users}
            title='Rooms for every crew'
            body='Your household, your film club, your long-distance partner. Everyone joins with an invite code, and each room keeps its own list.'
            art={<RoomsArt />}
            delay={0}
          />
          <Card
            icon={FileSpreadsheet}
            title='Letterboxd import'
            body='Drop in your Letterboxd export and your watchlist lands ready to go. Star ratings come along too.'
            art={<ImportArt />}
            delay={0.06}
          />
          <Card
            icon={Bell}
            title='A queue for what’s new'
            body='When someone adds a title, it shows up in your New tab to swipe. Turn on notifications and you’ll get a nudge.'
            art={<QueueArt />}
            delay={0}
          />
          <Card
            icon={Heart}
            title='Favorites jump the line'
            body='Heart the ones you really mean. Favorites get bumped up when it’s time to pick.'
            art={<HeartArt />}
            delay={0.06}
          />
          <Card
            icon={MonitorPlay}
            title='Where to stream it'
            body='Every title shows where it’s streaming, renting or for sale, before anyone gets off the couch.'
            art={<StreamArt />}
            delay={0.12}
          />
          <Card
            icon={Eye}
            title='Seen it? Gone.'
            body='Mark something watched and it stops coming up. Your Watched shelf keeps the history.'
            art={<SeenArt />}
            delay={0}
          />
          <Card
            className='md:col-span-2'
            icon={Smartphone}
            title='Lives on your home screen'
            body='Looksee is built for phones first. Add it to your home screen and it opens like any other app, ready for the couch.'
            art={<PhoneArt />}
            delay={0.06}
          />
        </div>
      </div>
    </section>
  )
}

function Card({
  icon: Icon,
  title,
  body,
  art,
  className,
  delay,
}: {
  icon: typeof Users
  title: string
  body: string
  art: ReactNode
  className?: string
  delay: number
}) {
  return (
    <Reveal delay={delay} className={cn('group', className)}>
      <div className='relative flex h-full flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-background p-6 shadow-card transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-1 hover:shadow-pop'>
        <div className='relative h-40 overflow-hidden rounded-2xl bg-canvas'>{art}</div>
        <div className='mt-5 flex items-center gap-2'>
          <Icon className='h-4 w-4 text-foreground' aria-hidden />
          <h3 className='text-base font-bold'>{title}</h3>
        </div>
        <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>{body}</p>
      </div>
    </Reveal>
  )
}

const inView = { initial: 'rest', whileInView: 'go', viewport: { once: true, amount: 0.6 } } as const

function RoomsArt() {
  const rooms = [
    { name: 'Home', n: 2, bg: 'bg-tomato', r: -7, x: '6%', y: '24%' },
    { name: 'Movie Club', n: 6, bg: 'bg-cobalt', r: 3, x: '36%', y: '40%' },
    { name: 'Jo & me', n: 2, bg: 'bg-marigold', r: -3, x: '64%', y: '14%' },
  ]
  return (
    <motion.div {...inView} className='absolute inset-0'>
      <div aria-hidden className='halftone absolute -right-10 -top-10 h-40 w-40 rounded-full text-foreground/10' />
      {rooms.map((room, i) => (
        <motion.div
          key={room.name}
          variants={{ rest: { opacity: 0, y: 30, rotate: 0 }, go: { opacity: 1, y: 0, rotate: room.r } }}
          transition={{ duration: 0.8, ease: EASE_OUT, delay: i * 0.12 }}
          className='absolute w-[30%] min-w-[104px] max-w-[170px] rounded-xl border-2 border-ink bg-background p-2.5 shadow-pop sm:p-3'
          style={{ left: room.x, top: room.y }}
        >
          <div className='flex items-center justify-between'>
            <span className='truncate text-xs font-bold text-foreground sm:text-sm'>{room.name}</span>
            <span className={cn('h-3 w-3 rounded-full', room.bg)} />
          </div>
          <div className='mt-2 flex -space-x-1.5'>
            {Array.from({ length: Math.min(room.n, 4) }, (_, j) => (
              <span key={j} className={cn('h-5 w-5 rounded-full border-2 border-background', ['bg-tomato', 'bg-cobalt', 'bg-marigold', 'bg-ink'][(j + i) % 4])} />
            ))}
            {room.n > 4 && <span className='pl-2.5 text-[10px] font-semibold text-muted-foreground'>+{room.n - 4}</span>}
          </div>
        </motion.div>
      ))}
      <motion.span
        variants={{ rest: { opacity: 0, scale: 0.6 }, go: { opacity: 1, scale: 1 } }}
        transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.5 }}
        className='absolute bottom-3 right-4 rounded-md bg-ink px-2.5 py-1 font-mono text-xs font-semibold tracking-[0.25em] text-canvas'
      >
        K7Q2XP
      </motion.span>
    </motion.div>
  )
}

function ImportArt() {
  return (
    <motion.div {...inView} className='absolute inset-0 flex items-center justify-center gap-3'>
      <motion.div
        variants={{ rest: { x: -10, opacity: 0 }, go: { x: 0, opacity: 1 } }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className='relative grid h-[88px] w-[68px] place-items-center rounded-md border-2 border-ink bg-background shadow-sm'
      >
        <span className='absolute right-0 top-0 h-4 w-4 border-b-2 border-l-2 border-ink bg-canvas' />
        <span className='mt-4 font-mono text-[11px] font-bold text-foreground'>.csv</span>
      </motion.div>
      <motion.div
        variants={{ rest: { opacity: 0, x: -6 }, go: { opacity: 1, x: [0, 4, 0] } }}
        transition={{ duration: 1.2, delay: 0.3, x: { repeat: Infinity, duration: 1.4, delay: 0.8 } }}
      >
        <ArrowRight className='h-5 w-5 text-foreground' aria-hidden />
      </motion.div>
      <div className='relative h-[96px] w-[64px]'>
        {[TITLES[2], TITLES[5], TITLES[0]].map((t, i) => (
          <motion.div
            key={t.id}
            variants={{ rest: { opacity: 0, y: 20, rotate: 0 }, go: { opacity: 1, y: 0, rotate: (i - 1) * 8 } }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.5 + i * 0.12 }}
            className='absolute inset-0'
            style={{ left: (i - 1) * 14 }}
          >
            <Poster title={t} bare className='h-full w-full rounded' />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

function QueueArt() {
  return (
    <motion.div {...inView} className='absolute inset-0 grid place-items-center'>
      <div className='relative'>
        <motion.div
          variants={{ rest: { rotate: 0 }, go: { rotate: [0, -14, 12, -8, 5, 0] } }}
          transition={{ duration: 0.9, delay: 0.4 }}
          style={{ originY: 0.1 }}
          className='grid h-20 w-20 place-items-center rounded-full bg-background shadow-pop ring-2 ring-ink'
        >
          <Bell className='h-9 w-9 text-foreground' aria-hidden />
        </motion.div>
        <motion.span
          variants={{ rest: { scale: 0 }, go: { scale: 1 } }}
          transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.3 }}
          className='absolute -right-1 -top-1 grid h-7 min-w-[28px] place-items-center rounded-full bg-tomato px-1.5 text-xs font-bold text-ink ring-2 ring-canvas'
        >
          3
        </motion.span>
      </div>
    </motion.div>
  )
}

function HeartArt() {
  return (
    <motion.div {...inView} className='absolute inset-0 grid place-items-center'>
      <div aria-hidden className='halftone absolute inset-0 text-favorite/15' />
      <motion.div
        variants={{ rest: { scale: 0.5, opacity: 0 }, go: { scale: 1, opacity: 1 } }}
        transition={{ type: 'spring', stiffness: 260, damping: 12 }}
      >
        <motion.div animate={{ scale: [1, 1.15, 1, 1.1, 1] }} transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1 }}>
          <Heart className='h-16 w-16 fill-favorite text-favorite drop-shadow' aria-hidden />
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

function StreamArt() {
  const rows = [
    { label: 'Stream', w: '70%', c: 'bg-cobalt' },
    { label: 'Rent', w: '48%', c: 'bg-marigold' },
    { label: 'Buy', w: '36%', c: 'bg-tomato' },
  ]
  return (
    <motion.div {...inView} className='absolute inset-0 flex flex-col justify-center gap-2.5 px-6'>
      {rows.map((r, i) => (
        <div key={r.label} className='flex items-center gap-3'>
          <span className='w-12 text-xs font-semibold text-muted-foreground'>{r.label}</span>
          <motion.span
            variants={{ rest: { width: '0%' }, go: { width: r.w } }}
            transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.2 + i * 0.12 }}
            className={cn('flex h-7 items-center gap-1 rounded-md px-1', r.c)}
          >
            {Array.from({ length: 3 - i }, (_, j) => (
              <span key={j} className='h-5 w-5 flex-shrink-0 rounded bg-background/80' />
            ))}
          </motion.span>
        </div>
      ))}
    </motion.div>
  )
}

function SeenArt() {
  return (
    <motion.div {...inView} className='absolute inset-0 flex items-center justify-center gap-3'>
      {[TITLES[1], TITLES[4], TITLES[6]].map((t, i) => (
        <motion.div
          key={t.id}
          variants={i === 1
            ? { rest: { opacity: 1, scale: 1 }, go: { opacity: 0.25, scale: 0.9, filter: 'grayscale(1)' } }
            : { rest: { opacity: 0, y: 10 }, go: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay: i === 1 ? 0.8 : i * 0.1 }}
          className='relative w-[58px]'
        >
          <Poster title={t} bare className='rounded' />
          {i === 1 && (
            <motion.span
              variants={{ rest: { scale: 0 }, go: { scale: 1 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.7 }}
              className='absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ink text-canvas'
            >
              <Eye className='h-4 w-4' aria-hidden />
            </motion.span>
          )}
        </motion.div>
      ))}
    </motion.div>
  )
}

function PhoneArt() {
  return (
    <motion.div {...inView} className='absolute inset-0'>
      <div aria-hidden className='halftone absolute inset-y-0 left-0 w-1/2 text-foreground/10' />
      <div aria-hidden className='riso-multiply absolute right-[22%] top-4 h-36 w-36 rounded-full bg-marigold' />
      <div aria-hidden className='riso-multiply absolute right-[6%] top-14 h-28 w-28 rounded-full bg-cobalt/80' />
      <motion.div
        variants={{ rest: { y: 80, rotate: 0 }, go: { y: 18, rotate: -8 } }}
        transition={{ duration: 1, ease: EASE_OUT }}
        className='absolute right-[12%] top-0 h-[260px] w-[132px] rounded-[26px] border-[5px] border-ink bg-background p-2.5 shadow-modal'
      >
        <div className='mx-auto h-1.5 w-10 rounded-full bg-ink/80' />
        <div className='mt-3 grid grid-cols-3 gap-2'>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className={cn('aspect-square rounded-lg', i === 4 ? 'grid place-items-center bg-canvas ring-1 ring-ink/20' : 'bg-muted')}>
              {i === 4 && <LogoMark className='h-3 text-foreground' />}
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
