'use client'

import { useModalAnimation } from '@/lib/useModalAnimation'

interface JoinRoomWatchlistPromptModalProps {
  isOpen: boolean
  roomName?: string
  onSkip: () => void
  onAddNow: () => void
}

export function JoinRoomWatchlistPromptModal({
  isOpen,
  roomName,
  onSkip,
  onAddNow,
}: JoinRoomWatchlistPromptModalProps) {
  const { isClosing, handleClose } = useModalAnimation(onSkip)

  if (!isOpen && !isClosing) return null

  return (
    <div
      className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-overlay ${isClosing ? 'closing' : ''}`}
      onClick={handleClose}
    >
      <div
        className={`bg-card rounded-lg max-w-md w-full p-6 border border-border modal-content ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-3">One quick step</h2>
        <div className="space-y-3 mb-6">
          <p className="text-muted-foreground">
            Want to add all the movies and shows you want to watch{roomName ? ` in ${roomName}` : ''} now?
          </p>
          <p className="text-muted-foreground">
            Most people do this right away so recommendations get better and more fun for everyone.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 font-medium"
          >
            Not now
          </button>
          <button
            onClick={onAddNow}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
          >
            Yes, add now
          </button>
        </div>
      </div>
    </div>
  )
}
