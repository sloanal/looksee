'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal, ModalBody, ModalFooter, ModalHeader, useModal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { RatingFields } from '@/components/RatingFields'

interface AcceptAllModalProps {
  open: boolean
  /** Titles the confirmation copy counts, held steady while the dialog is open. */
  count: number
  /** Resolve with an error message to keep the dialog open and show it inline. */
  onConfirm: (rating: { status: string; excitement: number }) => Promise<string | void>
  onClose: () => void
}

/**
 * Picks the one rating that "accept all" writes to every title left in the New
 * queue, using the same status/excitement pills a single title is rated with.
 */
export function AcceptAllModal({ open, count, onConfirm, onClose }: AcceptAllModalProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size='sm'
      aria-label={`Accept all ${count} title${count === 1 ? '' : 's'}`}
    >
      {open && <AcceptAllBody count={count} onConfirm={onConfirm} />}
    </Modal>
  )
}

function AcceptAllBody({ count, onConfirm }: Pick<AcceptAllModalProps, 'count' | 'onConfirm'>) {
  const { handleClose } = useModal()
  const [status, setStatus] = useState('have_not_seen')
  const [excitement, setExcitement] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await onConfirm({ status, excitement })
      if (typeof result === 'string' && result) {
        setError(result)
        return
      }
      handleClose()
    } catch (err) {
      console.error('Accept all failed:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ModalHeader
        title={`Accept all ${count} title${count === 1 ? '' : 's'}?`}
        showClose={false}
      />
      <ModalBody className='space-y-4'>
        <RatingFields
          status={status}
          excitement={excitement}
          onStatusChange={setStatus}
          onExcitementChange={setExcitement}
          statusLegend='Rate them all as'
          excitementLegend='How excited are you?'
        />
        <div className='space-y-2 text-sm text-muted-foreground'>
          <p>Every title left in your queue gets this rating, and the queue is cleared.</p>
          <p>You can change any of them later from Browse.</p>
        </div>
        {error && <Notice variant='error'>{error}</Notice>}
      </ModalBody>
      <ModalFooter>
        <Button
          type='button'
          variant='outline'
          className='flex-1'
          onClick={handleClose}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button type='button' className='flex-1' onClick={handleConfirm} disabled={busy}>
          {busy && <Loader2 className='h-4 w-4 animate-spin' />}
          {busy ? 'Clearing…' : 'Accept all'}
        </Button>
      </ModalFooter>
    </>
  )
}
