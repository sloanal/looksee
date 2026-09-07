'use client'

import { useState } from 'react'
import { Modal, ModalBody, ModalFooter, ModalHeader, useModal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'
import { ROOM_NAME_MAX_LENGTH } from '@/components/RenameRoomModal'

export interface JoinedRoomResult {
  room: { id: string; name: string; inviteCode: string }
  alreadyMember?: boolean
  mediaItemCount: number
}

interface JoinRoomModalProps {
  open: boolean
  onClose: () => void
  onJoined: (result: JoinedRoomResult) => Promise<void> | void
}

// Keyboard-friendly: sit near the top on phones so the field stays visible.
const formOverlayClassName = '!items-start sm:!items-center pt-8 sm:pt-4'

export function JoinRoomModal({ open, onClose, onJoined }: JoinRoomModalProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      className={formOverlayClassName}
      aria-label='Join a room'
    >
      {open && <JoinRoomForm onJoined={onJoined} />}
    </Modal>
  )
}

function JoinRoomForm({ onJoined }: Pick<JoinRoomModalProps, 'onJoined'>) {
  const { handleClose } = useModal()
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setJoining(true)
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to join room')
        return
      }
      await onJoined(data as JoinedRoomResult)
      handleClose()
    } catch (err) {
      console.error('Failed to join room:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='flex min-h-0 flex-col'>
      <ModalHeader
        title='Join a room'
        description='Enter the 6-character code someone shared with you.'
        closeDisabled={joining}
      />
      <ModalBody className='space-y-4'>
        {error && <Notice variant='error'>{error}</Notice>}
        <Field label='Invite code' htmlFor='join-invite-code'>
          <Input
            id='join-invite-code'
            type='text'
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            required
            maxLength={6}
            autoComplete='off'
            autoCapitalize='characters'
            className='h-14 text-center font-mono text-2xl uppercase tracking-widest sm:text-2xl'
            placeholder='ABC123'
            autoFocus
            disabled={joining}
          />
        </Field>
      </ModalBody>
      <ModalFooter>
        <Button
          type='button'
          onClick={handleClose}
          variant='outline'
          className='flex-1'
          disabled={joining}
        >
          Cancel
        </Button>
        <Button
          type='submit'
          disabled={joining || inviteCode.trim().length === 0}
          className='flex-1'
        >
          {joining ? 'Joining...' : 'Join'}
        </Button>
      </ModalFooter>
    </form>
  )
}

interface CreateRoomModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => Promise<void> | void
}

export function CreateRoomModal({ open, onClose, onCreated }: CreateRoomModalProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      className={formOverlayClassName}
      aria-label='Create a room'
    >
      {open && <CreateRoomForm onCreated={onCreated} />}
    </Modal>
  )
}

function CreateRoomForm({ onCreated }: Pick<CreateRoomModalProps, 'onCreated'>) {
  const { handleClose } = useModal()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to create room')
        return
      }
      await onCreated()
      handleClose()
    } catch (err) {
      console.error('Failed to create room:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='flex min-h-0 flex-col'>
      <ModalHeader
        title='Create a room'
        description="You'll get an invite code to share with your household."
        closeDisabled={creating}
      />
      <ModalBody className='space-y-4'>
        {error && <Notice variant='error'>{error}</Notice>}
        <Field label='Room name' htmlFor='create-room-name'>
          <Input
            id='create-room-name'
            type='text'
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={ROOM_NAME_MAX_LENGTH}
            placeholder='e.g., Our Apartment'
            autoFocus
            disabled={creating}
          />
        </Field>
      </ModalBody>
      <ModalFooter>
        <Button
          type='button'
          onClick={handleClose}
          variant='outline'
          className='flex-1'
          disabled={creating}
        >
          Cancel
        </Button>
        <Button
          type='submit'
          disabled={creating || name.trim().length === 0}
          className='flex-1'
        >
          {creating ? 'Creating...' : 'Create'}
        </Button>
      </ModalFooter>
    </form>
  )
}
