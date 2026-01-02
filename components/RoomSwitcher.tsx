'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

interface Room {
  id: string
  name: string
  inviteCode: string
  role: string
}

export function RoomSwitcher() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
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

  if (loading || rooms.length <= 1) {
    return null
  }

  const currentRoom = rooms.find((r) => r.id === currentRoomId)

  return (
    <div className="px-4 py-2 bg-gray-50 border-b">
      <select
        value={currentRoomId || ''}
        onChange={(e) => {
          const roomId = e.target.value
          if (roomId) {
            router.push(`${pathname}?roomId=${roomId}`)
          }
        }}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white"
      >
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {room.name}
          </option>
        ))}
      </select>
    </div>
  )
}

