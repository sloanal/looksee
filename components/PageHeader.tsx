'use client'

import { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useRooms } from '@/components/useRooms'

/** Shared max width for the tab pages (header and content align to it). */
export const pageContainerClassName = 'mx-auto w-full max-w-4xl xl:max-w-5xl'

interface PageHeaderBarProps {
  children: ReactNode
  className?: string
}

/**
 * Sticky white header band. Paints edge to edge behind the page container so
 * the page itself can sit on the cream canvas.
 */
export function PageHeaderBar({ children, className }: PageHeaderBarProps) {
  return (
    <div className='sticky top-0 z-10 safe-top'>
      <div className='pointer-events-none absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 border-b border-border bg-background/95 backdrop-blur-sm' />
      <div className={cn('relative px-4 pb-3 pt-4', pageContainerClassName, className)}>
        {children}
      </div>
    </div>
  )
}

interface PageContentProps {
  children: ReactNode
  className?: string
}

/** Padded content region under a `PageHeaderBar`. */
export function PageContent({ children, className }: PageContentProps) {
  return <div className={cn('px-4 py-4', pageContainerClassName, className)}>{children}</div>
}

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  /** Rendered before the title (e.g. a back button). */
  leading?: ReactNode
  /** Rendered directly after the title (e.g. RoomSelector). */
  children?: ReactNode
  /** Pushed to the far right of the title row (e.g. RoomMembersAvatars). */
  right?: ReactNode
  className?: string
}

/** Title row + optional one-line muted subtitle shared by the main tab headers. */
export function PageHeader({
  title,
  subtitle,
  leading,
  children,
  right,
  className,
}: PageHeaderProps) {
  return (
    <div className={className}>
      <div className='flex min-h-[44px] items-center justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-2'>
          {leading}
          <h1 className='whitespace-nowrap text-2xl font-bold leading-tight tracking-tight text-foreground'>
            {title}
          </h1>
          {children}
        </div>
        {right}
      </div>
      {subtitle && <p className='mt-1 text-sm text-muted-foreground'>{subtitle}</p>}
    </div>
  )
}

/**
 * Name of the room selected via `?roomId=` as stored, or null for All Rooms,
 * Watched, no room, or while rooms are still loading (so callers can fall back
 * to their non-room copy instead of flashing "undefined").
 */
export function useSelectedRoomName(): string | null {
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')
  const { rooms } = useRooms()

  if (!roomId || roomId === 'all-rooms' || roomId === 'watched') return null
  return rooms.find((r) => r.id === roomId)?.name ?? null
}
