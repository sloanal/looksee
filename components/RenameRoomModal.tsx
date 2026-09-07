'use client'

import { useState } from 'react'
import { Modal, ModalBody, ModalFooter, ModalHeader, useModal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export const ROOM_NAME_MAX_LENGTH = 60

export interface RenamedRoom {
  id: string
  name: string
  inviteCode: string
  role: string
  memberCount: number
  mediaItemCount: number
}

interface RenameRoomModalProps {
  room: { id: string; name: string } | null
  onClose: () => void
  onRenamed: (room: RenamedRoom) => void
}

export function RenameRoomModal({ room, onClose, onRenamed }: RenameRoomModalProps) {
  return (
    <Modal isOpen={room !== null} onClose={onClose} aria-label='Rename room'>
      {room && <RenameRoomForm key={room.id} room={room} onRenamed={onRenamed} />}
    </Modal>
  )
}

interface RenameRoomFormProps {
  room: { id: string; name: string }
  onRenamed: (room: RenamedRoom) => void
}

function RenameRoomForm({ room, onRenamed }: RenameRoomFormProps) {
  const { handleClose } = useModal()
  const [name, setName] = useState(room.name)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const validate = (value: string): string | null => {
    if (value.length === 0) return 'Room name is required'
    if (value.length > ROOM_NAME_MAX_LENGTH) {
      return `Room name must be ${ROOM_NAME_MAX_LENGTH} characters or fewer`
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    const validationError = validate(trimmed)
    if (validationError) {
      setError(validationError)
      return
    }

    if (trimmed === room.name) {
      handleClose()
      return
    }

    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to rename room')
        return
      }
      onRenamed(data.room)
      handleClose()
    } catch (err) {
      console.error('Failed to rename room:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='flex min-h-0 flex-col' noValidate>
      <ModalHeader title='Rename room' closeDisabled={saving} />
      <ModalBody>
        <Field
          label='Room name'
          htmlFor='rename-room-name'
          error={error || undefined}
          help={`${name.trim().length}/${ROOM_NAME_MAX_LENGTH} characters`}
        >
          <Input
            id='rename-room-name'
            type='text'
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError('')
            }}
            maxLength={ROOM_NAME_MAX_LENGTH}
            placeholder='e.g., Our Apartment'
            autoFocus
            disabled={saving}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'rename-room-name-message' : undefined}
          />
        </Field>
      </ModalBody>
      <ModalFooter>
        <Button
          type='button'
          onClick={handleClose}
          variant='outline'
          className='flex-1'
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type='submit' disabled={saving} className='flex-1'>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </ModalFooter>
    </form>
  )
}
