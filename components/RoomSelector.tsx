'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, EyeOff, Globe, LucideIcon, Sofa } from 'lucide-react'
import { formatTitleCount } from '@/lib/rooms'
import { cn } from '@/lib/utils'
import { useRooms } from '@/components/useRooms'

export function RoomSelector() {
  const { rooms, allRoomsCount, watchedCount, loaded } = useRooms()
  const loading = !loaded
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentRoomId = searchParams.get('roomId')

  // Default to "All Rooms" when no roomId is in the URL
  useEffect(() => {
    if (loading) return
    if (!currentRoomId && pathname) {
      router.replace(`${pathname}?roomId=all-rooms`)
    }
  }, [loading, currentRoomId, pathname, router])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  if (loading) {
    return (
      <div
        className='h-9 w-28 animate-pulse rounded-full bg-secondary'
        aria-label='Loading rooms'
        role='status'
      />
    )
  }

  const currentRoom = rooms.find((r) => r.id === currentRoomId)
  const isAllRooms = currentRoomId === 'all-rooms' || !currentRoomId
  const isWatchedRoom = currentRoomId === 'watched'
  const displayName = isAllRooms
    ? 'All Rooms'
    : isWatchedRoom
    ? 'Watched'
    : currentRoom
    ? currentRoom.name
    : 'All Rooms'

  const handleSelect = (roomId: string | null) => {
    setIsOpen(false)
    if (roomId) {
      router.push(`${pathname}?roomId=${roomId}`)
    } else {
      router.push(`${pathname}`)
    }
  }

  return (
    <div className='relative min-w-0' ref={dropdownRef}>
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup='listbox'
        aria-expanded={isOpen}
        className='flex h-9 max-w-[11rem] items-center gap-1 rounded-full border border-input bg-background pl-3 pr-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      >
        <span className='truncate'>{displayName}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div
          role='listbox'
          className='absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-pop'
        >
          <RoomOption
            icon={Globe}
            label='All Rooms'
            hint='All items across rooms'
            count={formatTitleCount(allRoomsCount)}
            selected={isAllRooms}
            onSelect={() => handleSelect('all-rooms')}
          />
          {rooms.map((room) => {
            const otherCount = room.memberCount - 1
            // Unwatched-for-me rather than the room's full catalog, so the number
            // equals the cards Browse shows when this room is picked.
            return (
              <RoomOption
                key={room.id}
                icon={Sofa}
                label={room.name}
                hint={`Shared with ${otherCount} other${otherCount !== 1 ? 's' : ''}`}
                count={formatTitleCount(room.unwatchedCount)}
                selected={currentRoomId === room.id}
                onSelect={() => handleSelect(room.id)}
              />
            )
          })}
          <div className='my-1 border-t border-border' />
          <RoomOption
            icon={EyeOff}
            label='Watched'
            hint="Titles you've already seen"
            count={formatTitleCount(watchedCount)}
            selected={isWatchedRoom}
            muted
            onSelect={() => handleSelect('watched')}
          />
        </div>
      )}
    </div>
  )
}

interface RoomOptionProps {
  icon: LucideIcon
  label: ReactNode
  hint: ReactNode
  count: string
  selected: boolean
  muted?: boolean
  onSelect: () => void
}

function RoomOption(
  { icon: Icon, label, hint, count, selected, muted, onSelect }: RoomOptionProps,
) {
  return (
    <button
      type='button'
      role='option'
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent',
        selected && 'bg-accent font-medium',
      )}
    >
      <Icon className='mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground' />
      <div className='min-w-0 flex-1'>
        <div className={cn('truncate', muted && 'text-muted-foreground')}>{label}</div>
        <div className='truncate text-xs font-normal text-muted-foreground'>{hint}</div>
      </div>
      <span className='flex-shrink-0 pt-0.5 text-xs font-normal tabular-nums text-muted-foreground'>
        {count}
      </span>
    </button>
  )
}
