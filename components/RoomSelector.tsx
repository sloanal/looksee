'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

interface Room {
  id: string
  name: string
  inviteCode: string
  role: string
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
    return <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
  }

  const currentRoom = rooms.find((r) => r.id === currentRoomId)
  const displayName = currentRoom ? currentRoom.name : 'My Stuff'

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
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
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
        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={() => handleSelect(null)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                !currentRoomId ? 'bg-gray-50 font-medium' : ''
              }`}
            >
              My Stuff
            </button>
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => handleSelect(room.id)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                  currentRoomId === room.id ? 'bg-gray-50 font-medium' : ''
                }`}
              >
                {room.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

