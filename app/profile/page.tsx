'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Sofa } from 'lucide-react'
import { RoomJoinModal } from '@/components/RoomJoinModal'
import { JoinRoomWatchlistPromptModal } from '@/components/JoinRoomWatchlistPromptModal'
import { RoomSelector } from '@/components/RoomSelector'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import { RoomMembersModal } from '@/components/RoomMembersModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

export default function ProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'profile' | 'rooms'>('profile')

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
  const [showRoomJoinModal, setShowRoomJoinModal] = useState(false)
  const [showWatchlistPrompt, setShowWatchlistPrompt] = useState(false)
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null)
  const [joinedRoomName, setJoinedRoomName] = useState('')
  const [joinedMediaCount, setJoinedMediaCount] = useState(0)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [selectedRoomForMembers, setSelectedRoomForMembers] = useState<Room | null>(null)
  const [imageError, setImageError] = useState(false)
  
  // Modal closing states
  const [inviteModalClosing, setInviteModalClosing] = useState(false)
  const [joinModalClosing, setJoinModalClosing] = useState(false)
  const [createModalClosing, setCreateModalClosing] = useState(false)
  
  const handleCloseInviteModal = () => {
    setInviteModalClosing(true)
    setTimeout(() => {
      setShowInviteModal(null)
      setInviteModalClosing(false)
    }, 200)
  }
  
  const handleCloseJoinModal = () => {
    setJoinModalClosing(true)
    setTimeout(() => {
      setShowJoinModal(false)
      setJoinInviteCode('')
      setJoinError('')
      setJoinModalClosing(false)
    }, 200)
  }
  
  const handleCloseCreateModal = () => {
    setCreateModalClosing(true)
    setTimeout(() => {
      setShowCreateModal(false)
      setRoomName('')
      setCreateError('')
      setCreateModalClosing(false)
    }, 200)
  }

  // Reset image error when user or imageUrl changes
  useEffect(() => {
    setImageError(false)
  }, [user?.imageUrl])

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
      const [userRes, roomsRes] = await Promise.all([
        fetch('/api/user/profile'),
        fetch('/api/rooms'),
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

      // If already a member, just refresh and close
      if (data.alreadyMember) {
        await loadData()
        setShowJoinModal(false)
        setJoinInviteCode('')
        return
      }

      // First step: ask whether they want to add their watchlist now
      setJoinedRoomId(data.room.id)
      setJoinedRoomName(data.room.name || '')
      setJoinedMediaCount(data.mediaItemCount)
      await loadData()
      setShowJoinModal(false)
      setJoinInviteCode('')
      setShowWatchlistPrompt(true)
    } catch (err) {
      console.error('Failed to join room:', err)
      setJoinError('Something went wrong. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  const handleSkipWatchlistPrompt = () => {
    setShowWatchlistPrompt(false)
    // If there are existing items, continue to queue onboarding step.
    if (joinedMediaCount > 0) {
      setShowRoomJoinModal(true)
      return
    }
    if (joinedRoomId) {
      router.push(`/browse?roomId=${joinedRoomId}`)
    }
  }

  const handleAddWatchlistNow = () => {
    setShowWatchlistPrompt(false)
    if (joinedRoomId) {
      router.push(`/add?roomId=${joinedRoomId}`)
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
    // Use setTimeout to ensure modal closes before navigation
    setTimeout(() => {
      router.push('/new')
    }, 100)
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
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="sticky top-0 bg-background border-b border-border z-10">
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4 text-foreground">Settings</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('rooms')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'rooms'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Rooms ({rooms.length})
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 bg-content min-h-[calc(100vh-200px)]">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">Personal Details</h2>
                {!editing && (
                  <Button
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </Button>
                )}
              </div>

              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Profile Image</label>
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
                          className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {uploading && (
                          <p className="text-xs text-primary mt-1">Uploading...</p>
                        )}
                      </div>
                      {editImageUrl && (
                        <Button
                          type="button"
                          onClick={() => setEditImageUrl('')}
                          variant="destructive"
                          size="sm"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload an image from your device (max 5MB)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Name</label>
                    <Input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Email</label>
                    <Input
                      type="email"
                      value={user?.email || ''}
                      disabled
                    />
                    <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={saving || !editName.trim()}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      onClick={() => {
                        setEditing(false)
                        setEditName(user?.name || '')
                        setEditImageUrl(user?.imageUrl || '')
                      }}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    {user?.imageUrl && !imageError ? (
                      <div className="w-20 h-20 flex-shrink-0">
                        <Image
                          src={user.imageUrl}
                          alt={user.name}
                          width={80}
                          height={80}
                          className="rounded-full object-cover w-full h-full"
                          style={{ width: '80px', height: '80px' }}
                          unoptimized
                          onError={() => setImageError(true)}
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-2xl text-foreground">
                        {user?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">{user?.name}</h3>
                      <p className="text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-card rounded-lg shadow-sm border border-border p-6 mt-6">
              <h2 className="text-xl font-bold mb-4 text-foreground">Account</h2>
              <div className="flex justify-end">
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10 hover:border-destructive"
                >
                  Log Out
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rooms' && (
          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setShowCreateModal(true)}
                size="sm"
                className="text-white hover:opacity-90"
                style={{ backgroundColor: '#7A8471' }} // Sage green from avatar palette
              >
                Create Room
              </Button>
              <Button
                onClick={() => setShowJoinModal(true)}
                size="sm"
              >
                Join Room
              </Button>
            </div>
            {rooms.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p className="text-lg">No rooms yet</p>
                <Link
                  href="/rooms/setup"
                  className="text-primary hover:underline mt-2 inline-block"
                >
                  Create your first room
                </Link>
              </div>
            ) : (
              rooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-card rounded-lg shadow-sm border border-border p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <DuotoneIcon icon={Sofa} size={18} />
                        <h3 
                          className="font-semibold text-lg text-foreground cursor-pointer hover:text-primary transition-colors"
                          onClick={() => {
                            setSelectedRoomForMembers(room)
                            setShowMembersModal(true)
                          }}
                        >
                          {room.name}
                        </h3>
                        {room.role === 'owner' && (
                          <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">
                            Owner
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {room.memberCount} member{room.memberCount !== 1 ? 's' : ''} •{' '}
                        {room.mediaItemCount} item{room.mediaItemCount !== 1 ? 's' : ''}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          onClick={() => handleEnterRoom(room.id)}
                          size="sm"
                        >
                          Enter Room
                        </Button>
                        <Button
                          onClick={() => setShowInviteModal(room)}
                          variant="outline"
                          size="sm"
                        >
                          Invite
                        </Button>
                        {room.role === 'owner' ? (
                          <Button
                            onClick={() => handleDeleteRoom(room.id)}
                            disabled={deletingRoomId === room.id}
                            variant="outline"
                            size="sm"
                            className="border-destructive text-destructive hover:bg-destructive/10 hover:border-destructive ml-auto"
                          >
                            {deletingRoomId === room.id ? 'Deleting...' : 'Delete'}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleLeaveRoom(room.id)}
                            disabled={leavingRoomId === room.id}
                            variant="outline"
                            size="sm"
                            className="border-orange-600 text-orange-600 hover:bg-orange-600/10 hover:border-orange-600 ml-auto"
                          >
                            {leavingRoomId === room.id ? 'Leaving...' : 'Leave Room'}
                          </Button>
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

      {(showInviteModal || inviteModalClosing) && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-overlay ${inviteModalClosing ? 'closing' : ''}`} onClick={handleCloseInviteModal}>
          <div className={`bg-card rounded-lg max-w-md w-full p-6 modal-content relative border border-border ${inviteModalClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            {showInviteModal && (
              <>
                <button
                  onClick={handleCloseInviteModal}
                  className="absolute top-4 right-4 z-10 text-muted-foreground text-2xl hover:text-foreground transition-colors"
                >
                  ×
                </button>
                <div className="mb-4 pr-8">
                  <h2 className="text-2xl font-bold text-foreground">Invite to {showInviteModal.name}</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Invite Code</label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={showInviteModal.inviteCode}
                        readOnly
                        className="flex-1 font-mono bg-muted"
                      />
                      <Button
                        onClick={() => copyInviteCode(showInviteModal.inviteCode)}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Share this code with others so they can join your room. They can enter it on the
                    rooms setup page.
                  </p>
                  <Button
                    onClick={handleCloseInviteModal}
                    variant="outline"
                    className="w-full"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {(showJoinModal || joinModalClosing) && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start sm:items-center justify-center pt-8 px-4 pb-4 sm:p-4 modal-overlay ${joinModalClosing ? 'closing' : ''}`} onClick={handleCloseJoinModal}>
          <div className={`bg-card rounded-lg max-w-md w-full p-6 modal-content relative border border-border ${joinModalClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleCloseJoinModal}
              className="absolute top-4 right-4 z-10 text-muted-foreground text-2xl hover:text-foreground transition-colors"
            >
              ×
            </button>
            <div className="mb-4 pr-8">
              <h2 className="text-2xl font-bold text-foreground">Join a Room</h2>
            </div>
            <form onSubmit={handleJoinRoom} className="space-y-4">
              {joinError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded">
                  {joinError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">Invite Code</label>
                <Input
                  type="text"
                  value={joinInviteCode}
                  onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())}
                  required
                  maxLength={6}
                  className="text-center text-2xl font-mono tracking-widest uppercase"
                  placeholder="ABC123"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleCloseJoinModal}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={joining}
                  className="flex-1"
                >
                  {joining ? 'Joining...' : 'Join'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(showCreateModal || createModalClosing) && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-overlay ${createModalClosing ? 'closing' : ''}`} onClick={handleCloseCreateModal}>
          <div className={`bg-card rounded-lg max-w-md w-full p-6 modal-content relative border border-border ${createModalClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleCloseCreateModal}
              className="absolute top-4 right-4 z-10 text-muted-foreground text-2xl hover:text-foreground transition-colors"
            >
              ×
            </button>
            <div className="mb-4 pr-8">
              <h2 className="text-2xl font-bold text-foreground">Create a Room</h2>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              {createError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded">
                  {createError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">Room Name</label>
                <Input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  required
                  placeholder="e.g., Our Apartment"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleCloseCreateModal}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating || !roomName.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RoomJoinModal
        isOpen={showRoomJoinModal}
        mediaCount={joinedMediaCount}
        roomId={joinedRoomId || ''}
        onSkip={handleSkipQueue}
        onGoToQueue={handleGoToQueue}
      />
      <JoinRoomWatchlistPromptModal
        isOpen={showWatchlistPrompt}
        roomName={joinedRoomName}
        onSkip={handleSkipWatchlistPrompt}
        onAddNow={handleAddWatchlistNow}
      />

      <RoomMembersModal
        isOpen={showMembersModal}
        onClose={() => {
          setShowMembersModal(false)
          setSelectedRoomForMembers(null)
        }}
        roomId={selectedRoomForMembers?.id || null}
        roomName={selectedRoomForMembers?.name || ''}
      />
    </div>
  )
}

