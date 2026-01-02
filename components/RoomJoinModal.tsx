'use client'

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
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">Welcome to the room!</h2>
        <div className="space-y-4 mb-6">
          <p className="text-gray-700">
            There {mediaCount === 1 ? 'is' : 'are'} <strong>{mediaCount}</strong> movie{mediaCount !== 1 ? 's' : ''} in this room! Take a moment to weigh in on your status and excitement for each one.
          </p>
          <p className="text-gray-700">
            This way other people will know what you're into and watch recommendations will be more fun and accurate.
          </p>
          <p className="text-gray-600 text-sm">
            You can skip this for now if you want and come back to your queue later.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
          >
            Skip for now
          </button>
          <button
            onClick={onGoToQueue}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            Go to my queue
          </button>
        </div>
      </div>
    </div>
  )
}

