'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { EyeOff, Globe, Sofa } from 'lucide-react'

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
    return <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
  }

  const currentRoom = rooms.find((r) => r.id === currentRoomId)
  const isAllRooms = currentRoomId === 'all-rooms' || !currentRoomId
  const isWatchedRoom = currentRoomId === 'watched'
  const displayName = isAllRooms ? 'All Rooms' : isWatchedRoom ? 'Watched' : currentRoom ? currentRoom.name : 'All Rooms'

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
        <span className="whitespace-nowrap">{displayName}</span>
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
              onClick={() => handleSelect('all-rooms')}
              className={`w-full text-left pl-3 pr-4 py-2 text-sm hover:bg-accent ${
                isAllRooms ? 'bg-accent font-medium' : ''
              }`}
            >
              <div className="flex items-start gap-1.5">
                <Globe className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex flex-col min-w-0">
                  <div className="whitespace-nowrap">All Rooms</div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">All items across rooms</div>
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
                    <Sofa className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="whitespace-nowrap truncate">{room.name}</div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        Shared with {otherCount} other{otherCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
            <div className="my-1 border-t border-border" />
            <button
              onClick={() => handleSelect('watched')}
              className={`w-full text-left pl-3 pr-4 py-2 text-sm hover:bg-accent ${
                isWatchedRoom ? 'bg-accent font-medium' : ''
              }`}
            >
              <div className="flex items-start gap-1.5">
                <EyeOff className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex flex-col min-w-0">
                  <div className="whitespace-nowrap text-muted-foreground">Watched</div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">Titles you&apos;ve already seen</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

