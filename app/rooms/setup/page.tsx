'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { RoomJoinModal } from '@/components/RoomJoinModal'

export default function RoomSetupPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [mode, setMode] = useState<'create' | 'join' | null>(null)
  const [roomName, setRoomName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null)
  const [joinedMediaCount, setJoinedMediaCount] = useState(0)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
    }
  }, [session, status, router])

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create room')
        return
      }

      // Redirect to onboarding if there are existing items, otherwise to browse
      router.push(`/onboarding?roomId=${data.room.id}`)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.toUpperCase() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to join room')
        return
      }

      // If already a member or no media items, redirect directly
      if (data.alreadyMember || !data.mediaItemCount || data.mediaItemCount === 0) {
        router.push(`/browse?roomId=${data.room.id}`)
        return
      }

      // Show modal for existing room with media items
      setJoinedRoomId(data.room.id)
      setJoinedMediaCount(data.mediaItemCount)
      setShowJoinModal(true)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkipQueue = () => {
    setShowJoinModal(false)
    if (joinedRoomId) {
      router.push(`/browse?roomId=${joinedRoomId}`)
    }
  }

  const handleGoToQueue = () => {
    setShowJoinModal(false)
    if (joinedRoomId) {
      router.push(`/onboarding?roomId=${joinedRoomId}`)
    }
  }

  if (!session) {
    return null
  }

  if (mode === null) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome to Looksee</h1>
            <p className="text-gray-600">Get started by creating or joining a room</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-medium hover:bg-blue-700 transition-colors text-lg"
            >
              Create a Room
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full bg-white border-2 border-gray-300 text-gray-700 py-4 rounded-lg font-medium hover:bg-gray-50 transition-colors text-lg"
            >
              Join a Room
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'create') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Create a Room</h1>
            <p className="text-gray-600">Give your room a name</p>
          </div>

          <form onSubmit={handleCreateRoom} className="bg-white rounded-lg shadow-md p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-1">
                Room Name
              </label>
              <input
                id="roomName"
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Our Apartment"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Join a Room</h1>
          <p className="text-gray-600">Enter the invite code</p>
        </div>

        <form onSubmit={handleJoinRoom} className="bg-white rounded-lg shadow-md p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-1">
              Invite Code
            </label>
            <input
              id="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              required
              maxLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl font-mono tracking-widest uppercase"
              placeholder="ABC123"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMode(null)}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Joining...' : 'Join'}
            </button>
          </div>
        </form>
      </div>

      <RoomJoinModal
        isOpen={showJoinModal}
        mediaCount={joinedMediaCount}
        roomId={joinedRoomId || ''}
        onSkip={handleSkipQueue}
        onGoToQueue={handleGoToQueue}
      />
    </div>
  )
}

