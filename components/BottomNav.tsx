'use client'

import { CSSProperties, MouseEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Bell, List, Play, Plus, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DuotoneIcon } from './DuotoneIcon'

const navItems = [
  { href: '/add', label: 'Add', icon: Plus },
  { href: '/browse', label: 'Browse', icon: List },
  { href: '/watch', label: 'Watch', icon: Play },
  { href: '/new', label: 'New', icon: Bell },
  { href: '/profile', label: 'Settings', icon: Settings },
]

/** Keep in step with `.nav-indicator` / `.nav-icon-pop` in globals.css. */
const SLIDE_MS = 460

/*
 * Each tab has its own layout, so every tab switch mounts a fresh nav, often
 * while the old one is still mid-glide. These carry what the last one knew
 * across: where the active bar was, any glide in progress (so the new nav can
 * pick it up mid-flight instead of jumping), and the queue count (so the badge
 * doesn't blink out and back while it's refetched).
 */
let lastActiveIndex: number | null = null
let inFlightSlide: { from: number; to: number; startedAt: number } | null = null
let lastQueueCount = 0

/** Where a freshly mounted nav's bar should glide in from, and how far along it already is. */
function arrivalFor(routeIndex: number) {
  if (routeIndex < 0) return null
  const now = performance.now()
  if (inFlightSlide && inFlightSlide.to === routeIndex) {
    const elapsed = now - inFlightSlide.startedAt
    if (elapsed < SLIDE_MS) return { from: inFlightSlide.from, elapsed }
    return null
  }
  if (lastActiveIndex !== null && lastActiveIndex >= 0 && lastActiveIndex !== routeIndex) {
    return { from: lastActiveIndex, elapsed: 0 }
  }
  return null
}

function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey &&
    !event.altKey
}

export function BottomNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')
  const { data: session, status } = useSession()
  const [queueCount, setQueueCount] = useState(lastQueueCount)
  // Only a badge that appears while you watch gets the pop, not one that was
  // already showing on the tab you came from.
  const [badgeWasShowing] = useState(() => lastQueueCount > 0)

  const routeIndex = navItems.findIndex(
    (item) => pathname === item.href || pathname?.startsWith(item.href + '/'),
  )
  // A tapped tab lights up straight away, before its route has loaded.
  const [tappedIndex, setTappedIndex] = useState<number | null>(null)
  const activeIndex = tappedIndex ?? routeIndex
  // Set once, on mount: whether this nav's bar glides in from another tab.
  const [arrival] = useState(() => arrivalFor(routeIndex))
  const popIndex = tappedIndex ?? (arrival ? routeIndex : null)
  // Carry on from the old nav's frame rather than restarting.
  const arrivalDelay = arrival && tappedIndex === null ? `${-arrival.elapsed}ms` : undefined

  useEffect(() => {
    lastActiveIndex = activeIndex
  }, [activeIndex])

  useEffect(() => {
    lastQueueCount = queueCount
  }, [queueCount])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      setQueueCount(0)
      return
    }

    const fetchQueueCount = async () => {
      try {
        const res = await fetch('/api/user/queue')
        if (res.ok) {
          const data = await res.json()
          setQueueCount(data.items?.length || 0)
        }
      } catch (err) {
        console.error('Failed to fetch queue count:', err)
      }
    }

    fetchQueueCount()

    // Listen for custom event when queue is updated
    const handleQueueUpdate = () => {
      fetchQueueCount()
    }
    window.addEventListener('queueUpdated', handleQueueUpdate)

    // Refetch when window gains focus (user returns to tab)
    const handleFocus = () => {
      fetchQueueCount()
    }
    window.addEventListener('focus', handleFocus)

    // Poll every 5 seconds to keep count updated
    const interval = setInterval(fetchQueueCount, 5000)

    return () => {
      clearInterval(interval)
      window.removeEventListener('queueUpdated', handleQueueUpdate)
      window.removeEventListener('focus', handleFocus)
    }
  }, [session, status, pathname])

  const getHref = (href: string) => {
    if (roomId) {
      return `${href}?roomId=${roomId}`
    }
    return href
  }

  return (
    <nav
      aria-label='Main'
      className='fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm bottom-nav-safe safe-x'
    >
      <div className='relative mx-auto flex h-16 max-w-full items-stretch justify-around md:max-w-4xl xl:max-w-5xl'>
        {activeIndex >= 0 && (
          <span
            aria-hidden
            data-slide={arrival && tappedIndex === null ? '' : undefined}
            className='nav-indicator pointer-events-none absolute left-0 top-0 flex h-0.5 justify-center'
            style={{
              width: `${100 / navItems.length}%`,
              '--from': arrival?.from ?? activeIndex,
              '--to': activeIndex,
              animationDelay: arrivalDelay,
            } as CSSProperties}
          >
            <span className='h-full w-8 rounded-b-full bg-primary' />
          </span>
        )}
        {navItems.map((item, index) => {
          const isActive = index === activeIndex
          return (
            <Link
              key={item.href}
              href={getHref(item.href)}
              aria-current={index === routeIndex ? 'page' : undefined}
              onClick={(event) => {
                if (!isPlainClick(event) || index === activeIndex) return
                inFlightSlide = { from: activeIndex, to: index, startedAt: performance.now() }
                setTappedIndex(index)
              }}
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 pt-1.5',
                'touch-manipulation transition-colors active:opacity-70',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <div
                className={cn('relative', index === popIndex && 'nav-icon-pop')}
                style={index === popIndex ? { animationDelay: arrivalDelay } : undefined}
              >
                <DuotoneIcon icon={item.icon} active={isActive} className='flex-shrink-0' />
                {item.href === '/new' && queueCount > 0 && (
                  <span
                    className={cn(
                      'absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-favorite px-1 text-[10px] font-bold tabular-nums text-favorite-foreground shadow-sm ring-2 ring-background',
                      !badgeWasShowing && 'motion-badge',
                    )}
                  >
                    {queueCount > 99 ? '99+' : queueCount}
                  </span>
                )}
              </div>
              <span className='w-full truncate text-center text-[11px] font-medium leading-tight'>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
