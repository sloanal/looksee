'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal, ModalBody, ModalFooter, ModalHeader, useModal } from '@/components/ui/modal'
import { Notice } from '@/components/ui/notice'
import { formatTitleCount, notifyRoomsChanged } from '@/lib/rooms'
import { clientSubmissionContext } from '@/lib/submission-context'

interface JoinRoomWatchlistPromptModalProps {
  isOpen: boolean
  roomId: string | null
  roomName?: string
  /** "Not now" (or dismiss before importing). */
  onSkip: () => void
  /** Fires after a successful import so the page can refresh its own room data. */
  onImported?: (added: number) => void
}

export function JoinRoomWatchlistPromptModal({
  isOpen,
  roomId,
  roomName,
  onSkip,
  onImported,
}: JoinRoomWatchlistPromptModalProps) {
  return (
    <Modal isOpen={isOpen && roomId !== null} onClose={onSkip} aria-label='Add your watchlist'>
      {isOpen && roomId !== null && (
        <WatchlistPromptBody
          key={roomId}
          roomId={roomId}
          roomName={roomName}
          onImported={onImported}
        />
      )}
    </Modal>
  )
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; count: number }
  | { kind: 'importing'; count: number }
  | { kind: 'done'; added: number }
  | { kind: 'empty'; total: number }

interface WatchlistPromptBodyProps {
  roomId: string
  roomName?: string
  onImported?: (added: number) => void
}

function WatchlistPromptBody({ roomId, roomName, onImported }: WatchlistPromptBodyProps) {
  const router = useRouter()
  const { handleClose } = useModal()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [error, setError] = useState('')

  const inRoom = roomName ? ` in ${roomName}` : ''
  const toRoom = roomName ? ` to ${roomName}` : ' to the room'
  const browseHref = `/browse?roomId=${roomId}`
  const addHref = `/add?roomId=${roomId}`

  const loadCount = useCallback(async (isCancelled: () => boolean = () => false) => {
    setError('')
    setPhase({ kind: 'loading' })
    try {
      const res = await fetch(`/api/rooms/${roomId}/import-watchlist`)
      const data = await res.json().catch(() => ({}))
      if (isCancelled()) return
      if (!res.ok) {
        setError(data.error || "Couldn't check your watchlist. Please try again.")
        setPhase({ kind: 'failed' })
        return
      }
      const count = Number(data.count) || 0
      if (count > 0) {
        setPhase({ kind: 'ready', count })
      } else {
        setPhase({ kind: 'empty', total: Number(data.total) || 0 })
      }
    } catch (err) {
      console.error('Failed to check watchlist:', err)
      if (isCancelled()) return
      setError("Couldn't check your watchlist. Please try again.")
      setPhase({ kind: 'failed' })
    }
  }, [roomId])

  useEffect(() => {
    let cancelled = false
    loadCount(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [loadCount])

  const handleImport = async () => {
    if (phase.kind !== 'ready') return
    setError('')
    setPhase({ kind: 'importing', count: phase.count })
    try {
      const res = await fetch(`/api/rooms/${roomId}/import-watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientSubmissionContext()),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Couldn't add your watchlist. Please try again.")
        setPhase({ kind: 'ready', count: phase.count })
        return
      }
      const added = Number(data.added) || 0
      notifyRoomsChanged()
      onImported?.(added)
      setPhase({ kind: 'done', added })
    } catch (err) {
      console.error('Failed to import watchlist:', err)
      setError("Couldn't add your watchlist. Please try again.")
      setPhase({ kind: 'ready', count: phase.count })
    }
  }

  const errorBanner = error ? <Notice variant='error'>{error}</Notice> : null

  if (phase.kind === 'done') {
    return (
      <>
        <ModalHeader title="You're all set" showClose={false} />
        <ModalBody className='space-y-3 text-sm text-muted-foreground'>
          <p>
            Added {formatTitleCount(phase.added)}
            {toRoom}.
          </p>
          <p>
            Everyone in the room can now see what you want to watch, so recommendations will get
            better right away.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant='secondary' className='flex-1' onClick={() => router.push(addHref)}>
            Add something else
          </Button>
          <Button className='flex-1' onClick={() => router.push(browseHref)}>
            Go to room
          </Button>
        </ModalFooter>
      </>
    )
  }

  if (phase.kind === 'empty') {
    const alreadyThere = phase.total > 0
    return (
      <>
        <ModalHeader title='One quick step' showClose={false} />
        <ModalBody className='space-y-3 text-sm text-muted-foreground'>
          {alreadyThere ? <p>Everything you want to watch is already{inRoom}. Nice.</p> : (
            <p>
              You don&apos;t have a watchlist yet — search to add something you want to watch
              {inRoom}.
            </p>
          )}
          <p>
            Adding what you&apos;re into makes recommendations better and more fun for everyone.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant='secondary' className='flex-1' onClick={handleClose}>
            Not now
          </Button>
          {alreadyThere
            ? (
              <Button className='flex-1' onClick={() => router.push(browseHref)}>
                Go to room
              </Button>
            )
            : (
              <Button className='flex-1' onClick={() => router.push(addHref)}>
                Search to add something
              </Button>
            )}
        </ModalFooter>
      </>
    )
  }

  const busy = phase.kind === 'loading' || phase.kind === 'importing'
  const count = phase.kind === 'ready' || phase.kind === 'importing' ? phase.count : 0

  return (
    <>
      <ModalHeader title='One quick step' showClose={false} />
      <ModalBody className='space-y-3 text-sm text-muted-foreground'>
        <p>Want to add all the movies and shows you want to watch{inRoom} now?</p>
        <p>
          Most people do this right away so recommendations get better and more fun for everyone.
        </p>
        {errorBanner}
      </ModalBody>
      <ModalFooter>
        <Button
          variant='secondary'
          className='flex-1'
          onClick={handleClose}
          disabled={phase.kind === 'importing'}
        >
          Not now
        </Button>
        {phase.kind === 'failed'
          ? (
            <Button className='flex-1' onClick={() => loadCount()}>
              Try again
            </Button>
          )
          : (
            <Button className='flex-1' onClick={handleImport} disabled={busy}>
              {phase.kind === 'loading'
                ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Checking…
                  </>
                )
                : phase.kind === 'importing'
                ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Adding…
                  </>
                )
                : `Add ${formatTitleCount(count)} you want to watch`}
            </Button>
          )}
      </ModalFooter>
    </>
  )
}
