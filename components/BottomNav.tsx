'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { List, Plus, Play, Settings, Bell } from 'lucide-react'
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
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border safe-bottom safe-x z-50">
      <div className="flex justify-around items-center h-20 max-w-full overflow-hidden pb-7">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={getHref(item.href)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 min-w-0 px-1 pt-1 relative',
                'transition-colors active:opacity-70 touch-manipulation',
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <div className="relative">
                <DuotoneIcon icon={item.icon} active={isActive} className="mb-1 flex-shrink-0" />
                {item.href === '/new' && queueCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#ff1493] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-sm">
                    {queueCount > 99 ? '99+' : queueCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium truncate w-full text-center leading-tight">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

