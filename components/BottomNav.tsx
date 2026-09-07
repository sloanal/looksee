'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Bell, List, Play, Plus, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DuotoneIcon } from './DuotoneIcon'

export function BottomNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')
  const { data: session, status } = useSession()
  const [queueCount, setQueueCount] = useState(0)

  const navItems = [
    { href: '/add', label: 'Add', icon: Plus },
    { href: '/browse', label: 'Browse', icon: List },
    { href: '/watch', label: 'Watch', icon: Play },
    { href: '/new', label: 'New', icon: Bell },
    { href: '/profile', label: 'Settings', icon: Settings },
  ]

  useEffect(() => {
    if (status === 'loading' || !session) {
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
      <div className='mx-auto flex h-16 max-w-full items-stretch justify-around md:max-w-4xl xl:max-w-5xl'>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={getHref(item.href)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 pt-1.5',
                'touch-manipulation transition-colors active:opacity-70',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-b-full bg-primary transition-opacity',
                  isActive ? 'opacity-100' : 'opacity-0',
                )}
              />
              <div className='relative'>
                <DuotoneIcon icon={item.icon} active={isActive} className='flex-shrink-0' />
                {item.href === '/new' && queueCount > 0 && (
                  <span className='absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-favorite px-1 text-[10px] font-bold tabular-nums text-favorite-foreground shadow-sm ring-2 ring-background'>
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
