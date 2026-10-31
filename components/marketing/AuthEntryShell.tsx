'use client'

import Link from 'next/link'
import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { motion, MotionConfig } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { BrandVideo } from '@/components/BrandVideo'
import { cn } from '@/lib/utils'
import { AuthBrandPanel } from './AuthBrandPanel'
import { Logo } from './Logo'
import { EASE_OUT } from './Reveal'

const TABS = [
  { href: '/auth/signin', label: 'Log in' },
  { href: '/auth/signup', label: 'Sign up' },
]

export function AuthEntryShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <MotionConfig reducedMotion='user'>
      <div className='site-scroll paper-grain min-h-[100dvh] bg-canvas lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]'>
        <AuthBrandPanel />

        <div className='flex min-h-[100dvh] flex-col px-5 pb-8 pt-5 safe-bottom sm:px-10'>
          <header className='flex items-center justify-between'>
            <Logo className='lg:invisible' />
            <Link
              href='/'
              className='group inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground'
            >
              <ArrowLeft className='h-4 w-4 transition-transform group-hover:-translate-x-0.5' aria-hidden />
              Home
            </Link>
          </header>

          <div className='flex flex-1 justify-center py-8 lg:pt-[13vh]'>
            <div className='w-full max-w-sm'>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: EASE_OUT }}
                className='mx-auto mb-6 grid h-32 w-32 place-items-center rounded-full bg-canvas shadow-pop ring-2 ring-ink lg:hidden'
              >
                <BrandVideo className='aspect-[720/544] w-[80%]' />
              </motion.div>

              <nav
                aria-label='Account'
                className='relative grid grid-cols-2 rounded-full border border-foreground/10 bg-background/70 p-1 shadow-sm backdrop-blur'
              >
                {TABS.map((tab) => {
                  const active = pathname === tab.href
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative rounded-full py-2.5 text-center text-sm font-semibold transition-colors duration-300',
                        active ? 'text-canvas' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId='auth-tab'
                          className='absolute inset-0 rounded-full bg-ink shadow-sm'
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        />
                      )}
                      <span className='relative'>{tab.label}</span>
                    </Link>
                  )
                })}
              </nav>

              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE_OUT }}
                className='mt-8'
              >
                {children}
              </motion.div>
            </div>
          </div>

          <p className='text-center text-xs text-muted-foreground'>
            Spend less time deciding what to watch.
          </p>
        </div>
      </div>
    </MotionConfig>
  )
}
