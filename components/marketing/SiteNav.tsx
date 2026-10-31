'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from './Logo'
import { EASE_OUT } from './Reveal'

const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#solo', label: 'Solo mode' },
  { href: '#features', label: 'Features' },
]

/**
 * Floats over the hero, then settles into a frosted pill once you scroll, so
 * Log in and Sign up are always one tap away.
 */
export function SiteNav() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24))

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE_OUT }}
      className='fixed inset-x-0 top-0 z-50 px-3 pt-3 safe-top sm:px-5 sm:pt-4'
    >
      <nav
        aria-label='Main'
        className={cn(
          'mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-2xl border px-3 py-2 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500 sm:px-4',
          scrolled
            ? 'border-foreground/10 bg-canvas/80 shadow-pop backdrop-blur-xl'
            : 'border-transparent bg-transparent',
        )}
      >
        <Logo />

        <ul className='hidden items-center gap-1 md:flex'>
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className='rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground'
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className='flex items-center gap-1.5 sm:gap-2'>
          <Link
            href='/auth/signin'
            className='rounded-full px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/5'
          >
            Log in
          </Link>
          <Link
            href='/auth/signup'
            className='group inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-canvas shadow-sm transition-transform active:scale-[0.97]'
          >
            Sign up
            <ArrowRight
              className='h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5'
              aria-hidden
            />
          </Link>
        </div>
      </nav>
    </motion.header>
  )
}
