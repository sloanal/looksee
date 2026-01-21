'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
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
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !roomId) {
      setMembers([])
      return
    }

    setLoading(true)
    fetch(`/api/rooms/${roomId}/members`)
      .then((res) => res.json())
      .then((data) => {
        if (data.members) {
          setMembers(data.members)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch room members:', err)
        setMembers([])
      })
      .finally(() => setLoading(false))
  }, [isOpen, roomId])

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Members of {roomName}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 text-2xl hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading members...</div>
        ) : members.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No members found</div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="relative w-12 h-12 rounded-full border-2 border-gray-200 overflow-hidden bg-muted flex-shrink-0">
                  {member.imageUrl ? (
                    <Image
                      src={member.imageUrl}
                      alt={member.name}
                      fill
                      className="object-cover"
                      sizes="48px"
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
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded flex-shrink-0">
                        Owner
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate">{member.email}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AnimatedModal>
  )
}
