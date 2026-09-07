'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal, ModalBody, ModalFooter, ModalHeader, useModal } from '@/components/ui/modal'
import { clientSubmissionContext } from '@/lib/submission-context'
import { cn } from '@/lib/utils'

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

export function EditRoomsModal(props: EditRoomsModalProps) {
  return (
    <Modal isOpen onClose={props.onClose} aria-label='Edit rooms'>
      <EditRoomsBody {...props} />
    </Modal>
  )
}

function EditRoomsBody({ mediaItemId, currentRooms, onSave }: EditRoomsModalProps) {
  const { data: session } = useSession()
  const { handleClose } = useModal()
  const [allRooms, setAllRooms] = useState<Room[]>([])
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load all rooms the user is a member of
    const loadRooms = async () => {
      try {
        const [allRoomsRes, itemRoomsRes] = await Promise.all([
          fetch('/api/rooms'),
          fetch(`/api/media/${mediaItemId}/rooms`),
        ])
        if (allRoomsRes.ok) {
          const data = await allRoomsRes.json()
          const filteredRooms = (data.rooms || []).filter(
            (room: Room) => room.name.trim().toLowerCase() !== PERSONAL_ROOM_NAME,
          )
          setAllRooms(filteredRooms)
          if (itemRoomsRes.ok) {
            const itemRooms = await itemRoomsRes.json()
            setSelectedRoomIds(
              (itemRooms.rooms || []).map((room: MediaItemRoom) => room.id),
            )
          } else {
            setSelectedRoomIds(currentRooms.map((r) => r.id))
          }
        }
      } catch (err) {
        console.error('Failed to load rooms:', err)
      } finally {
        setLoading(false)
      }
    }

    loadRooms()
  }, [currentRooms, mediaItemId])

  const handleToggleRoom = (roomId: string) => {
    setSelectedRoomIds((prev) => {
      if (prev.includes(roomId)) {
        // Check if user can remove this room
        const room = currentRooms.find((r) => r.id === roomId)
        if (room && room.addedByUserId !== session?.user?.id) {
          alert(
            `You cannot remove this item from "${room.name}" because you did not add it to this room.`,
          )
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
        body: JSON.stringify({ roomIds: selectedRoomIds, ...clientSubmissionContext() }),
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

  return (
    <>
      <ModalHeader
        title='Edit rooms'
        description='Choose which rooms this title belongs to. You can only remove it from rooms you added it to.'
      />
      <ModalBody>
        {loading
          ? <p className='py-6 text-center text-sm text-muted-foreground'>Loading...</p>
          : (
            <div className='space-y-2'>
              {allRooms.map((room) => {
                const isSelected = selectedRoomIds.includes(room.id)
                const currentRoom = currentRooms.find((r) => r.id === room.id)
                const canRemove = !currentRoom ||
                  currentRoom.addedByUserId === session?.user?.id
                const locked = !canRemove && isSelected

                return (
                  <label
                    key={room.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-background hover:bg-accent',
                      locked && 'cursor-not-allowed opacity-70',
                    )}
                  >
                    <input
                      type='checkbox'
                      checked={isSelected}
                      onChange={() => handleToggleRoom(room.id)}
                      disabled={locked}
                      className='sr-only'
                    />
                    <span
                      aria-hidden
                      className={cn(
                        'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background',
                      )}
                    >
                      {isSelected && <Check className='h-3.5 w-3.5' strokeWidth={3} />}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <span className='block truncate font-medium text-foreground'>
                        {room.name}
                      </span>
                      {currentRoom && (
                        <p className='text-xs text-muted-foreground'>
                          Added by {currentRoom.addedByName}
                        </p>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          )}
      </ModalBody>
      <ModalFooter>
        <Button onClick={handleClose} variant='outline' className='flex-1'>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || loading} className='flex-1'>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </ModalFooter>
    </>
  )
}
