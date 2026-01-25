'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { getAvatarColor } from '@/lib/utils'

interface Member {
  id: string
  name: string
  imageUrl: string | null
  email: string
  role: string
}

export function RoomMembersAvatars() {
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!roomId) {
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
  }, [roomId])

  if (!roomId || members.length === 0) {
    return null
  }

  // Show up to 4 avatars, then show +X for the rest
  const maxVisible = 4
  const visibleMembers = members.slice(0, maxVisible)
  const hiddenCount = members.length - maxVisible

  return (
    <div className="flex items-center -space-x-2">
      {visibleMembers.map((member) => {
        const imageFailed = member.imageUrl && failedImages.has(member.imageUrl)
        const showImage = member.imageUrl && !imageFailed
        
        return (
          <div
            key={member.id}
            className="relative w-8 h-8 rounded-full border-2 border-background overflow-hidden bg-muted flex-shrink-0"
            title={member.name}
          >
            {showImage ? (
              <Image
                src={member.imageUrl}
                alt={member.name}
                fill
                className="object-cover"
                sizes="32px"
                onError={() => {
                  if (member.imageUrl) {
                    setFailedImages((prev) => new Set(prev).add(member.imageUrl!))
                  }
                }}
              />
            ) : (
              <div 
                className="w-full h-full flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: getAvatarColor(member.id || member.name) }}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )
      })}
      {hiddenCount > 0 && (
        <div
          className="relative w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium text-foreground flex-shrink-0"
          title={`${hiddenCount} more member${hiddenCount !== 1 ? 's' : ''}`}
        >
          +{hiddenCount}
        </div>
      )}
    </div>
  )
}
