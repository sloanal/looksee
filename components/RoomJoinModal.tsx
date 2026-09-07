'use client'

import { Button } from '@/components/ui/button'
import { Modal, ModalBody, ModalFooter, ModalHeader, useModal } from '@/components/ui/modal'

interface RoomJoinModalProps {
  isOpen: boolean
  mediaCount: number
  roomId: string
  onSkip: () => void
  onGoToQueue: () => void
}

export function RoomJoinModal({ isOpen, mediaCount, onSkip, onGoToQueue }: RoomJoinModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onSkip} aria-label='Welcome to the room'>
      <RoomJoinBody mediaCount={mediaCount} onGoToQueue={onGoToQueue} />
    </Modal>
  )
}

function RoomJoinBody(
  { mediaCount, onGoToQueue }: Pick<RoomJoinModalProps, 'mediaCount' | 'onGoToQueue'>,
) {
  const { handleClose: handleSkip } = useModal()

  return (
    <>
      <ModalHeader title='Welcome to the room!' showClose={false} />
      <ModalBody className='space-y-3 text-sm text-muted-foreground'>
        <p>
          There {mediaCount === 1 ? 'is' : 'are'}{' '}
          <strong className='text-foreground'>{mediaCount}</strong>{' '}
          movie{mediaCount !== 1 ? 's' : ''}{' '}
          in this room! Take a moment to weigh in on your status and excitement for each one.
        </p>
        <p>
          This way other people will know what you&apos;re into and watch recommendations will be
          more fun and accurate.
        </p>
        <p className='text-xs'>
          You can skip this for now if you want and come back to your queue later.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant='secondary' className='flex-1' onClick={handleSkip}>
          Skip for now
        </Button>
        <Button className='flex-1' onClick={onGoToQueue}>
          Go rate what&apos;s new
        </Button>
      </ModalFooter>
    </>
  )
}
