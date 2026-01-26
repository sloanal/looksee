'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { AnimatedModal } from './AnimatedModal'
import { getAvatarColor } from '@/lib/utils'

interface Member {
  id: string
  name: string
  imageUrl: string | null
  email: string
  role: string
}

interface RoomMembersModalProps {
  isOpen: boolean
  onClose: () => void
  roomId: string | null
  roomName: string
}

export function RoomMembersModal({
  isOpen,
  onClose,
  roomId,
  roomName,
}: RoomMembersModalProps) {
  const { data: session } = useSession()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())
  const [currentUserRole, setCurrentUserRole] = useState<string>('member')

  const fetchMembers = () => {
    if (!roomId) return

    setLoading(true)
    fetch(`/api/rooms/${roomId}/members`)
      .then((res) => res.json())
      .then((data) => {
        if (data.members) {
          setMembers(data.members)
        }
        if (data.currentUserRole) {
          setCurrentUserRole(data.currentUserRole)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch room members:', err)
        setMembers([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!isOpen || !roomId) {
      setMembers([])
      return
    }

    fetchMembers()
  }, [isOpen, roomId])

  const handleRemoveMember = async (userId: string) => {
    if (!roomId) return

    if (!confirm('Are you sure you want to remove this member from the room?')) {
      return
    }

    setRemovingUserId(userId)
    try {
      const response = await fetch(`/api/rooms/${roomId}/members`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to remove member')
        return
      }

      // Refresh the member list
      fetchMembers()
    } catch (err) {
      console.error('Failed to remove member:', err)
      alert('Failed to remove member')
    } finally {
      setRemovingUserId(null)
    }
  }

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} contentClassName="relative">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 z-10 text-gray-500 text-2xl hover:text-gray-700"
      >
        ×
      </button>
      <div className="p-6">
        <div className="mb-4 pr-8">
          <h2 className="text-2xl font-bold text-gray-900">Members of {roomName}</h2>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading members...</div>
        ) : members.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No members found</div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {members.map((member) => {
              const imageUrl = member.imageUrl
              const imageFailed = imageUrl && failedImages.has(imageUrl)
              const showImage = imageUrl && !imageFailed
              
              const isCurrentUser = session?.user?.id === member.id
              const canRemove = currentUserRole === 'owner' && !isCurrentUser

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="relative w-12 h-12 rounded-full border-2 border-gray-200 overflow-hidden bg-muted flex-shrink-0">
                    {showImage ? (
                      <Image
                        src={imageUrl}
                        alt={member.name}
                        fill
                        className="object-cover"
                        sizes="48px"
                        onError={() => {
                          if (imageUrl) {
                            setFailedImages((prev) => new Set(prev).add(imageUrl))
                          }
                        }}
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: getAvatarColor(member.id || member.name) }}
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">{member.name}</p>
                      {member.role === 'owner' && (
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded flex-shrink-0">
                          Owner
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{member.email}</p>
                  </div>
                  {canRemove && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={removingUserId === member.id}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {removingUserId === member.id ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AnimatedModal>
  )
}
