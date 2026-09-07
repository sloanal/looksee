'use client'

import { ReactNode, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal, ModalBody, ModalFooter, ModalHeader, useModal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'

interface ConfirmModalProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  busyLabel?: string
  destructive?: boolean
  /** Resolve with an error message to keep the modal open and show it inline. */
  onConfirm: () => Promise<string | void> | string | void
  onClose: () => void
}

export function ConfirmModal(props: ConfirmModalProps) {
  return (
    <Modal isOpen={props.open} onClose={props.onClose} size='sm' aria-label={props.title}>
      {props.open && <ConfirmBody {...props} />}
    </Modal>
  )
}

function ConfirmBody({
  title,
  description,
  confirmLabel,
  busyLabel,
  destructive = false,
  onConfirm,
}: ConfirmModalProps) {
  const { handleClose } = useModal()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await onConfirm()
      if (typeof result === 'string' && result) {
        setError(result)
        return
      }
      handleClose()
    } catch (err) {
      console.error('Confirm action failed:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ModalHeader title={title} showClose={false} />
      <ModalBody className='space-y-3'>
        <div className='space-y-2 text-sm text-muted-foreground'>{description}</div>
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
        <Button
          type='button'
          variant={destructive ? 'destructive' : 'default'}
          className='flex-1'
          onClick={handleConfirm}
          disabled={busy}
        >
          {busy && <Loader2 className='h-4 w-4 animate-spin' />}
          {busy ? busyLabel ?? confirmLabel : confirmLabel}
        </Button>
      </ModalFooter>
    </>
  )
}
