'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Ellipsis, Share, SquarePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EASE_OUT, Reveal } from './Reveal'

/** How to put Looksee on an iPhone home screen, where it's meant to live. */
export function InstallSection() {
  return (
    <section id='install' aria-labelledby='install-title' className='scroll-mt-24 px-5 pb-20 sm:px-8 sm:pb-28'>
      <Reveal y={32} className='mx-auto max-w-6xl'>
        <div className='grid items-center gap-10 overflow-hidden rounded-[2rem] border border-foreground/10 bg-background p-7 shadow-card sm:p-12 md:grid-cols-[1fr_auto] md:gap-14'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground'>
              Get the app
            </p>
            <h2 id='install-title' className='font-display mt-4 text-[clamp(2rem,4vw,3rem)] leading-[0.98]'>
              Made for your <span className='font-accent text-[1.1em]'>home screen.</span>
            </h2>
            <p className='mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg'>
              Looksee is a web app designed to live on your iPhone like any other app: full screen,
              no browser bars, one tap away when it&apos;s time to pick something. There&apos;s
              nothing to download from the App Store. Adding it takes about ten seconds.
            </p>

            <ol className='mt-8 space-y-4'>
              <Step n={1}>
                Open this page in <strong className='font-semibold text-foreground'>Safari</strong>.
              </Step>
              <Step n={2}>
                Tap the <Key icon={Share}>Share</Key> button. On newer iPhones it&apos;s under the{' '}
                <Key icon={Ellipsis} label='More' /> button next to the address bar.
              </Step>
              <Step n={3}>
                Scroll down and tap <Key icon={SquarePlus}>Add to Home Screen</Key>. If you
                don&apos;t see it, tap <strong className='font-semibold text-foreground'>View More</strong>.
              </Step>
              <Step n={4}>
                Leave <strong className='font-semibold text-foreground'>Open as Web App</strong> on
                if you see it, then tap <strong className='font-semibold text-foreground'>Add</strong>.
                Looksee is now on your home screen.
              </Step>
            </ol>

            <p className='mt-6 text-sm text-muted-foreground'>
              On Android, open Chrome&apos;s menu and tap <span className='font-medium text-foreground'>Add to home screen</span>.
            </p>
          </div>

          <HomeScreen />
        </div>
      </Reveal>
    </section>
  )
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className='flex gap-4'>
      <span className='font-display grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-ink text-sm text-canvas'>
        {n}
      </span>
      <p className='pt-1 text-[15px] leading-relaxed text-muted-foreground sm:text-base'>{children}</p>
    </li>
  )
}

/** An inline chip showing the iOS control to look for. */
function Key({ icon: Icon, children, label }: { icon: typeof Share; children?: ReactNode; label?: string }) {
  return (
    <span className='mx-0.5 inline-flex translate-y-[-1px] items-center gap-1.5 whitespace-nowrap rounded-md border border-foreground/15 bg-canvas px-1.5 py-0.5 align-middle text-sm font-semibold text-foreground'>
      <Icon className='h-3.5 w-3.5' aria-hidden />
      {children}
      {label && <span className='sr-only'>{label}</span>}
    </span>
  )
}

/** A phone's home screen, with Looksee landing in the middle of the grid. */
function HomeScreen() {
  const tints = ['bg-tomato/25', 'bg-cobalt/25', 'bg-marigold/30', 'bg-muted']
  return (
    <div aria-hidden className='relative mx-auto w-[170px] py-4 sm:w-[210px]'>
      <div className='riso-multiply absolute -left-8 top-10 h-36 w-36 rounded-full bg-marigold' />
      <div className='riso-multiply absolute -right-6 bottom-12 h-28 w-28 rounded-full bg-cobalt/80' />
      <motion.div
        initial={{ rotate: 0, y: 24 }}
        whileInView={{ rotate: -4, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 1, ease: EASE_OUT }}
        className='relative aspect-[9/19] w-full rounded-[2.4rem] border-[6px] border-ink bg-canvas p-4 shadow-modal'
      >
        <div className='mx-auto h-5 w-20 rounded-full bg-ink' />
        <div className='mt-6 grid grid-cols-4 gap-x-2.5 gap-y-4'>
          {Array.from({ length: 16 }, (_, i) =>
            i === 9
              ? (
                <motion.div
                  key={i}
                  className='flex flex-col items-center gap-1'
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.6 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src='/apple-icon-180x180.png'
                    alt=''
                    className='aspect-square w-full rounded-[22%] shadow-pop ring-1 ring-ink/10'
                  />
                  <span className='text-[8px] font-semibold leading-none text-foreground'>Looksee</span>
                </motion.div>
              )
              : (
                <div key={i} className='flex flex-col items-center gap-1'>
                  <div className={cn('aspect-square w-full rounded-[22%]', tints[(i * 7) % tints.length])} />
                  <span className='h-[5px] w-3/4 rounded-full bg-foreground/10' />
                </div>
              )
          )}
        </div>
        <div className='absolute inset-x-4 bottom-4 grid grid-cols-4 gap-2.5 rounded-2xl bg-foreground/5 p-2'>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className='aspect-square rounded-[22%] bg-foreground/10' />
          ))}
        </div>
      </motion.div>
    </div>
  )
}
