'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { ErrorText } from '@/components/ui/field'

interface InviteRoomModalProps {
  room: { id: string; name: string; inviteCode: string } | null
  onClose: () => void
}

export function InviteRoomModal({ room, onClose }: InviteRoomModalProps) {
  return (
    <Modal isOpen={room !== null} onClose={onClose} aria-label='Invite to room'>
      {room && <InviteBody key={room.id} room={room} />}
    </Modal>
  )
}

function InviteBody({ room }: { room: NonNullable<InviteRoomModalProps['room']> }) {
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const shareText = `Join "${room.name}" on Looksee with invite code ${room.inviteCode}`

  const handleCopy = async () => {
    setError('')
    try {
      await navigator.clipboard.writeText(room.inviteCode)
      setCopied(true)
    } catch (err) {
      console.error('Failed to copy invite code:', err)
      setError("Couldn't copy. Long-press the code to copy it manually.")
    }
  }

  const handleShare = async () => {
    setError('')
    try {
      await navigator.share({
        title: `Join ${room.name} on Looksee`,
        text: shareText,
        url: window.location.origin,
      })
    } catch (err) {
      // Dismissing the share sheet rejects with AbortError; that's not a failure.
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Failed to share invite:', err)
      setError("Couldn't open the share sheet. Copy the code instead.")
    }
  }

  return (
    <>
      <ModalHeader
        title={`Invite to ${room.name}`}
        description='Anyone with this code can join from Settings → Rooms → Join room.'
      />
      <ModalBody className='space-y-3'>
        <div
          className='select-all rounded-xl border border-dashed border-input bg-canvas px-4 py-5 text-center'
          aria-label='Invite code'
        >
          <span className='font-mono text-3xl font-semibold tracking-[0.3em] text-foreground'>
            {room.inviteCode}
          </span>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </ModalBody>
      <ModalFooter>
        <Button
          type='button'
          onClick={handleCopy}
          className='flex-1'
          variant={canShare ? 'outline' : 'default'}
        >
          {copied ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
          {copied ? 'Copied!' : 'Copy code'}
        </Button>
        {canShare && (
          <Button type='button' onClick={handleShare} className='flex-1'>
            <Share2 className='h-4 w-4' />
            Share
          </Button>
        )}
      </ModalFooter>
    </>
  )
}
