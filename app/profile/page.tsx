'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { RoomJoinModal } from '@/components/RoomJoinModal'

interface User {
  id: string
  name: string
  email: string
  imageUrl?: string
}

interface Room {
  id: string
  name: string
  inviteCode: string
  role: string
  memberCount: number
  mediaItemCount: number
}

interface QueueItem {
  id: string
  title: string
  type: string
  posterUrl?: string
  genres: string[]
  createdBy: string
  roomId: string
  roomName: string
}

export default function ProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'details' | 'queue' | 'rooms'>('details')

  // Edit states
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Room management states
  const [showInviteModal, setShowInviteModal] = useState<Room | null>(null)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinInviteCode, setJoinInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null)
  const [leavingRoomId, setLeavingRoomId] = useState<string | null>(null)
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null)
  const [showRoomJoinModal, setShowRoomJoinModal] = useState(false)
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null)
  const [joinedMediaCount, setJoinedMediaCount] = useState(0)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }
    loadData()
  }, [session, status, router])

  const loadData = async () => {
    setLoading(true)
    try {
      const [userRes, roomsRes, queueRes] = await Promise.all([
        fetch('/api/user/profile'),
        fetch('/api/rooms'),
        fetch('/api/user/queue'),
      ])

      if (userRes.ok) {
        const userData = await userRes.json()
        setUser(userData.user)
        setEditName(userData.user.name)
        setEditImageUrl(userData.user.imageUrl || '')
      }

      if (roomsRes.ok) {
        const roomsData = await roomsRes.json()
        setRooms(roomsData.rooms || [])
      }

      if (queueRes.ok) {
        const queueData = await queueRes.json()
        setQueue(queueData.items || [])
      }
    } catch (err) {
      console.error('Failed to load profile data:', err)
    } finally {
      setLoading(false)
    }
  }

  const cropImageToSquare = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        // Use native HTMLImageElement constructor (not Next.js Image component)
        const img = document.createElement('img')
        img.onload = () => {
          // Calculate square crop dimensions (center crop)
          const size = Math.min(img.width, img.height)
          const x = (img.width - size) / 2
          const y = (img.height - size) / 2

          // Create canvas and crop to square
          const canvas = document.createElement('canvas')
          canvas.width = 400
          canvas.height = 400
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            reject(new Error('Could not get canvas context'))
            return
          }

          // Draw cropped and resized image
          ctx.drawImage(img, x, y, size, size, 0, 0, 400, 400)

          // Convert to blob and then to File
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create image blob'))
                return
              }
              const croppedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              })
              resolve(croppedFile)
            },
            'image/jpeg',
            0.9
          )
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      // Crop image to square before uploading
      const croppedFile = await cropImageToSquare(file)

      const formData = new FormData()
      formData.append('file', croppedFile)

      const res = await fetch('/api/user/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setEditImageUrl(data.imageUrl)
        return data.imageUrl
      } else {
        const text = await res.text()
        let errorMessage = 'Failed to upload image'
        try {
          const error = JSON.parse(text)
          errorMessage = error.error || errorMessage
        } catch {
          // If response is not JSON, use the text or default message
        }
        alert(errorMessage)
        return null
      }
    } catch (err) {
      console.error('Failed to upload file:', err)
      alert('Failed to process or upload image')
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await handleFileUpload(file)
    }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          imageUrl: editImageUrl || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setEditing(false)
        // Update session to reflect name change
        await update()
      } else {
        const text = await res.text()
        let errorMessage = 'Failed to update profile'
        try {
          const error = JSON.parse(text)
          errorMessage = error.error || errorMessage
        } catch {
          // If response is not JSON, use default message
        }
        alert(errorMessage)
      }
    } catch (err) {
      console.error('Failed to save profile:', err)
      alert('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
      return
    }

    setDeletingRoomId(roomId)
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setRooms(rooms.filter((r) => r.id !== roomId))
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to delete room')
      }
    } catch (err) {
      console.error('Failed to delete room:', err)
      alert('Failed to delete room')
    } finally {
      setDeletingRoomId(null)
    }
  }

  const handleLeaveRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to leave this room? You can rejoin later using the invite code.')) {
      return
    }

    setLeavingRoomId(roomId)
    try {
      const res = await fetch(`/api/rooms/${roomId}/leave`, {
        method: 'POST',
      })

      if (res.ok) {
        setRooms(rooms.filter((r) => r.id !== roomId))
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to leave room')
      }
    } catch (err) {
      console.error('Failed to leave room:', err)
      alert('Failed to leave room')
    } finally {
      setLeavingRoomId(null)
    }
  }

  const copyInviteCode = (inviteCode: string) => {
    navigator.clipboard.writeText(inviteCode)
    alert('Invite code copied to clipboard!')
  }

  const handleEnterRoom = (roomId: string) => {
    router.push(`/browse?roomId=${roomId}`)
  }

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setJoinError('')
    setJoining(true)

    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: joinInviteCode.toUpperCase() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setJoinError(data.error || 'Failed to join room')
        return
      }

      // If already a member or no media items, just refresh and close
      if (data.alreadyMember || !data.mediaItemCount || data.mediaItemCount === 0) {
        await loadData()
        setShowJoinModal(false)
        setJoinInviteCode('')
        return
      }

      // Show interstitial modal for existing room with media items
      setJoinedRoomId(data.room.id)
      setJoinedMediaCount(data.mediaItemCount)
      await loadData()
      setShowJoinModal(false)
      setJoinInviteCode('')
      setShowRoomJoinModal(true)
    } catch (err) {
      console.error('Failed to join room:', err)
      setJoinError('Something went wrong. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  const handleSkipQueue = () => {
    setShowRoomJoinModal(false)
    if (joinedRoomId) {
      router.push(`/browse?roomId=${joinedRoomId}`)
    }
  }

  const handleGoToQueue = () => {
    setShowRoomJoinModal(false)
    if (joinedRoomId) {
      router.push(`/onboarding?roomId=${joinedRoomId}`)
    }
  }

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreating(true)

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setCreateError(data.error || 'Failed to create room')
        return
      }

      // Refresh rooms list
      await loadData()
      // Close modal and reset form
      setShowCreateModal(false)
      setRoomName('')
    } catch (err) {
      console.error('Failed to create room:', err)
      setCreateError('Something went wrong. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      await signOut({ callbackUrl: '/auth/signin' })
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="text-center text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="sticky top-0 bg-white border-b z-10">
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Profile</h1>
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'details'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'queue'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500'
              }`}
            >
              Queue ({queue.length})
            </button>
            <button
              onClick={() => setActiveTab('rooms')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'rooms'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500'
              }`}
            >
              Rooms ({rooms.length})
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'details' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-bold">Personal Details</h2>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Profile Image</label>
                    <div className="flex gap-4 items-start">
                      {editImageUrl && (
                        <div className="flex-shrink-0 w-20 h-20">
                          <Image
                            src={editImageUrl}
                            alt="Profile"
                            width={80}
                            height={80}
                            className="rounded-full object-cover w-full h-full"
                            style={{ width: '80px', height: '80px' }}
                            unoptimized
                            onError={() => setEditImageUrl('')}
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          disabled={uploading}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {uploading && (
                          <p className="text-xs text-blue-600 mt-1">Uploading...</p>
                        )}
                      </div>
                      {editImageUrl && (
                        <button
                          type="button"
                          onClick={() => setEditImageUrl('')}
                          className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Upload an image from your device (max 5MB)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving || !editName.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false)
                        setEditName(user?.name || '')
                        setEditImageUrl(user?.imageUrl || '')
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    {user?.imageUrl ? (
                      <div className="w-20 h-20 flex-shrink-0">
                        <Image
                          src={user.imageUrl}
                          alt={user.name}
                          width={80}
                          height={80}
                          className="rounded-full object-cover w-full h-full"
                          style={{ width: '80px', height: '80px' }}
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl">
                        {user?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-semibold">{user?.name}</h3>
                      <p className="text-gray-600">{user?.email}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
              <h2 className="text-xl font-bold mb-4">Account</h2>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
              >
                Log Out
              </button>
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="space-y-4">
            {queue.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p className="text-lg">No items in your queue</p>
                <p className="text-sm mt-2">All media items have been rated!</p>
              </div>
            ) : (
              queue.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedQueueItem(item)}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex gap-4">
                    {item.posterUrl && (
                      <div className="flex-shrink-0">
                        <Image
                          src={item.posterUrl}
                          alt={item.title}
                          width={80}
                          height={120}
                          className="rounded object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                      <p className="text-sm text-gray-600 mb-2 capitalize">{item.type}</p>
                      <p className="text-sm text-gray-500">In: {item.roomName}</p>
                      {item.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.genres.slice(0, 3).map((genre, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'rooms' && (
          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
              >
                Create Room
              </button>
              <button
                onClick={() => setShowJoinModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                Join Room
              </button>
            </div>
            {rooms.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p className="text-lg">No rooms yet</p>
                <Link
                  href="/rooms/setup"
                  className="text-blue-600 hover:underline mt-2 inline-block"
                >
                  Create your first room
                </Link>
              </div>
            ) : (
              rooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{room.name}</h3>
                        {room.role === 'owner' && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                            Owner
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {room.memberCount} member{room.memberCount !== 1 ? 's' : ''} •{' '}
                        {room.mediaItemCount} item{room.mediaItemCount !== 1 ? 's' : ''}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleEnterRoom(room.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                          Enter Room
                        </button>
                        <button
                          onClick={() => setShowInviteModal(room)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
                        >
                          Invite
                        </button>
                        {room.role === 'owner' ? (
                          <button
                            onClick={() => handleDeleteRoom(room.id)}
                            disabled={deletingRoomId === room.id}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm disabled:opacity-50"
                          >
                            {deletingRoomId === room.id ? 'Deleting...' : 'Delete'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleLeaveRoom(room.id)}
                            disabled={leavingRoomId === room.id}
                            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm disabled:opacity-50"
                          >
                            {leavingRoomId === room.id ? 'Leaving...' : 'Leave Room'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">Invite to {showInviteModal.name}</h2>
              <button
                onClick={() => setShowInviteModal(null)}
                className="text-gray-500 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Invite Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={showInviteModal.inviteCode}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md bg-gray-100 font-mono"
                  />
                  <button
                    onClick={() => copyInviteCode(showInviteModal.inviteCode)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Share this code with others so they can join your room. They can enter it on the
                rooms setup page.
              </p>
              <button
                onClick={() => setShowInviteModal(null)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">Join a Room</h2>
              <button
                onClick={() => {
                  setShowJoinModal(false)
                  setJoinInviteCode('')
                  setJoinError('')
                }}
                className="text-gray-500 text-2xl"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleJoinRoom} className="space-y-4">
              {joinError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                  {joinError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">Invite Code</label>
                <input
                  type="text"
                  value={joinInviteCode}
                  onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())}
                  required
                  maxLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl font-mono tracking-widest uppercase"
                  placeholder="ABC123"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowJoinModal(false)
                    setJoinInviteCode('')
                    setJoinError('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {joining ? 'Joining...' : 'Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">Create a Room</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setRoomName('')
                  setCreateError('')
                }}
                className="text-gray-500 text-2xl"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                  {createError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">Room Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., Our Apartment"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setRoomName('')
                    setCreateError('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !roomName.trim()}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedQueueItem && (
        <QueueItemModal
          item={selectedQueueItem}
          onClose={() => setSelectedQueueItem(null)}
          onSave={() => {
            setSelectedQueueItem(null)
            loadData()
          }}
        />
      )}

      <RoomJoinModal
        isOpen={showRoomJoinModal}
        mediaCount={joinedMediaCount}
        roomId={joinedRoomId || ''}
        onSkip={handleSkipQueue}
        onGoToQueue={handleGoToQueue}
      />
    </div>
  )
}

function QueueItemModal({
  item,
  onClose,
  onSave,
}: {
  item: QueueItem
  onClose: () => void
  onSave: () => void
}) {
  const [status, setStatus] = useState('not_seen_want')
  const [excitement, setExcitement] = useState(3)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/media/${item.id}/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, excitement }),
      })

      if (res.ok) {
        onSave()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to save preference')
      }
    } catch (err) {
      console.error('Failed to save preference:', err)
      alert('Failed to save preference')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold">{item.title}</h2>
            <button onClick={onClose} className="text-gray-500 text-2xl">
              ×
            </button>
          </div>

          {item.posterUrl && (
            <div className="mb-4">
              <Image
                src={item.posterUrl}
                alt={item.title}
                width={200}
                height={300}
                className="rounded mx-auto"
              />
            </div>
          )}

          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2 capitalize">{item.type}</p>
            <p className="text-sm text-gray-500 mb-2">In: {item.roomName}</p>
            {item.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {item.genres.slice(0, 3).map((genre, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Status</label>
            <div className="space-y-2">
              {[
                { value: 'not_seen_want', label: "Haven&apos;t seen, want to watch" },
                { value: 'not_seen_dont_want', label: "Haven&apos;t seen, don&apos;t want to watch" },
                { value: 'seen_would_rewatch', label: 'Seen, would rewatch' },
                { value: 'seen_wont_rewatch', label: 'Seen, would not rewatch' },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value={opt.value}
                    checked={status === opt.value}
                    onChange={(e) => setStatus(e.target.value)}
                    className="mr-2"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Excitement: {excitement}/5
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={excitement}
              onChange={(e) => setExcitement(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1</span>
              <span>5</span>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

