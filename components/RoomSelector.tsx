'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { User, Globe, Sofa } from 'lucide-react'
import { DuotoneIcon } from './DuotoneIcon'

interface Room {
  id: string
  name: string
  inviteCode: string
  role: string
  memberCount: number
}

export function RoomSelector() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentRoomId = searchParams.get('roomId')

  useEffect(() => {
    fetch('/api/rooms')
      .then((res) => res.json())
      .then((data) => {
        if (data.rooms) {
          setRooms(data.rooms)
        }
      })
      .finally(() => setLoading(false))
  }, [])

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
    return <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
  }

  const currentRoom = rooms.find((r) => r.id === currentRoomId)
  const isAllRooms = currentRoomId === 'all-rooms'
  const displayName = isAllRooms ? 'Everything' : currentRoom ? currentRoom.name : 'Just My Stuff'

  const handleSelect = (roomId: string | null) => {
    setIsOpen(false)
    if (roomId) {
      router.push(`${pathname}?roomId=${roomId}`)
    } else {
      router.push(`${pathname}`)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 pl-3 pr-1.5 py-2 text-sm font-medium text-foreground rounded-md transition-all duration-200 neumorphic-button"
      >
        <span>{displayName}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-popover border border-border rounded-md shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={() => handleSelect(null)}
              className={`w-full text-left pl-3 pr-4 py-2 text-sm hover:bg-accent ${
                !currentRoomId ? 'bg-accent font-medium' : ''
              }`}
            >
              <div className="flex items-start gap-1.5">
                <DuotoneIcon icon={User} size={16} active={false} className="mt-0.5" />
                <div className="flex flex-col">
                  <div>Just My Stuff</div>
                  <div className="text-xs text-muted-foreground">Everything you&apos;ve added</div>
                </div>
              </div>
            </button>
            <button
              onClick={() => handleSelect('all-rooms')}
              className={`w-full text-left pl-3 pr-4 py-2 text-sm hover:bg-accent ${
                isAllRooms ? 'bg-accent font-medium' : ''
              }`}
            >
              <div className="flex items-start gap-1.5">
                <Globe className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="flex flex-col">
                  <div>Everything</div>
                  <div className="text-xs text-muted-foreground">Your rooms plus your stuff</div>
                </div>
              </div>
            </button>
            {rooms.map((room) => {
              const otherCount = room.memberCount - 1
              return (
                <button
                  key={room.id}
                  onClick={() => handleSelect(room.id)}
                  className={`w-full text-left pl-3 pr-4 py-2 text-sm hover:bg-accent ${
                    currentRoomId === room.id ? 'bg-accent font-medium' : ''
                  }`}
                >
                  <div className="flex items-start gap-1.5">
                    <Sofa className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex flex-col">
                      <div>{room.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Shared with {otherCount} other{otherCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

