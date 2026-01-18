'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { List, Plus, Play, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DuotoneIcon } from './DuotoneIcon'

export function BottomNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')

  const navItems = [
    { href: '/browse', label: 'Browse', icon: List },
    { href: '/add', label: 'Add', icon: Plus },
    { href: '/watch', label: 'Watch', icon: Play },
    { href: '/profile', label: 'Profile', icon: User },
  ]

  const getHref = (href: string) => {
    if (roomId) {
      return `${href}?roomId=${roomId}`
    }
    return href
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border safe-bottom safe-x z-50">
      <div className="flex justify-around items-center h-16 max-w-full overflow-hidden">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={getHref(item.href)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full min-w-0 px-1',
                'transition-colors active:opacity-70 touch-manipulation',
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <DuotoneIcon icon={item.icon} active={isActive} className="mb-1 flex-shrink-0" />
              <span className="text-xs font-medium truncate w-full text-center leading-tight">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

