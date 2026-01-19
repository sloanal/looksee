'use client'

import { useModalAnimation } from '@/lib/useModalAnimation'

interface RoomJoinModalProps {
  isOpen: boolean
  mediaCount: number
  roomId: string
  onSkip: () => void
  onGoToQueue: () => void
}

export function RoomJoinModal({
  isOpen,
  mediaCount,
  roomId,
  onSkip,
  onGoToQueue,
}: RoomJoinModalProps) {
  const { isClosing, handleClose: handleSkip } = useModalAnimation(onSkip)

  if (!isOpen && !isClosing) return null

  return (
    <div className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleSkip}>
      <div className={`bg-card rounded-lg max-w-md w-full p-6 border border-border modal-content ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">Welcome to the room!</h2>
        <div className="space-y-4 mb-6">
          <p className="text-muted-foreground">
            There {mediaCount === 1 ? 'is' : 'are'} <strong>{mediaCount}</strong> movie{mediaCount !== 1 ? 's' : ''} in this room! Take a moment to weigh in on your status and excitement for each one.
          </p>
          <p className="text-muted-foreground">
            This way other people will know what you&apos;re into and watch recommendations will be more fun and accurate.
          </p>
          <p className="text-muted-foreground text-sm">
            You can skip this for now if you want and come back to your queue later.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 font-medium"
          >
            Skip for now
          </button>
          <button
            onClick={() => {
              onGoToQueue()
            }}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
          >
            Go rate what's new
          </button>
        </div>
      </div>
    </div>
  )
}

