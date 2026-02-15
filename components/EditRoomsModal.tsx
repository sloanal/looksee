'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { useModalAnimation } from '@/lib/useModalAnimation'

interface Room {
  id: string
  name: string
}

const PERSONAL_ROOM_NAME = 'my stuff'

interface MediaItemRoom {
  id: string
  name: string
  addedByUserId: string
  addedByName: string
}

interface EditRoomsModalProps {
  mediaItemId: string
  currentRooms: MediaItemRoom[]
  onClose: () => void
  onSave: () => void
}

export function EditRoomsModal({
  mediaItemId,
  currentRooms,
  onClose,
  onSave,
}: EditRoomsModalProps) {
  const { data: session } = useSession()
  const { isClosing, handleClose } = useModalAnimation(onClose)
  const [allRooms, setAllRooms] = useState<Room[]>([])
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load all rooms the user is a member of
    const loadRooms = async () => {
      try {
        const res = await fetch('/api/rooms')
        if (res.ok) {
          const data = await res.json()
          const filteredRooms = (data.rooms || []).filter(
            (room: Room) => room.name.trim().toLowerCase() !== PERSONAL_ROOM_NAME
          )
          setAllRooms(filteredRooms)
          // Initialize selected rooms with current rooms
          setSelectedRoomIds(currentRooms.map((r) => r.id))
        }
      } catch (err) {
        console.error('Failed to load rooms:', err)
      } finally {
        setLoading(false)
      }
    }

    loadRooms()
  }, [currentRooms])

  const handleToggleRoom = (roomId: string) => {
    setSelectedRoomIds((prev) => {
      if (prev.includes(roomId)) {
        // Check if user can remove this room
        const room = currentRooms.find((r) => r.id === roomId)
        if (room && room.addedByUserId !== session?.user?.id) {
          alert(`You cannot remove this item from "${room.name}" because you did not add it to this room.`)
          return prev
        }
        return prev.filter((id) => id !== roomId)
      } else {
        return [...prev, roomId]
      }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/media/${mediaItemId}/rooms`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomIds: selectedRoomIds }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Failed to update rooms')
        return
      }

      handleClose()
      onSave()
    } catch (err) {
      console.error('Failed to save rooms:', err)
      alert('Failed to update rooms')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-overlay ${isClosing ? 'closing' : ''}`}>
        <div className={`bg-card rounded-lg max-w-md w-full modal-content ${isClosing ? 'closing' : ''}`}>
          <div className="p-6">
            <p className="text-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-overlay ${isClosing ? 'closing' : ''}`}
      onClick={handleClose}
    >
      <div
        className={`bg-card rounded-lg max-w-md w-full modal-content relative ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={handleClose} 
          className="absolute top-4 right-4 z-10 text-muted-foreground text-2xl hover:text-foreground"
        >
          ×
        </button>
        <div className="p-6">
          <div className="mb-4 pr-8">
            <h2 className="text-2xl font-bold text-foreground">Edit Rooms</h2>
          </div>

          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-3">
              Select which rooms this item belongs to. You can only remove items from rooms you added them to.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {allRooms.map((room) => {
                const isSelected = selectedRoomIds.includes(room.id)
                const currentRoom = currentRooms.find((r) => r.id === room.id)
                const canRemove = !currentRoom || currentRoom.addedByUserId === session?.user?.id

                return (
                  <label
                    key={room.id}
                    className={`flex items-center p-3 rounded border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border-primary'
                        : 'bg-background border-border hover:bg-muted'
                    } ${!canRemove && isSelected ? 'opacity-75' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleRoom(room.id)}
                      disabled={!canRemove && isSelected}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <span className="text-foreground font-medium">{room.name}</span>
                      {currentRoom && (
                        <p className="text-xs text-muted-foreground">
                          Added by {currentRoom.addedByName}
                        </p>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
