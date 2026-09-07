'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AvatarStack } from '@/components/ui/avatar'

interface Member {
  id: string
  name: string
  imageUrl: string | null
  role: string
}

interface RoomMembersAvatarsProps {
  /** Room to show. Defaults to the `roomId` query param (Browse/Watch/Add headers). */
  roomId?: string | null
  /** Change to force a refetch (e.g. when the member count changes). */
  refreshKey?: string | number
  size?: 'sm' | 'md'
  maxVisible?: number
  className?: string
}

const isVirtualRoom = (roomId: string | null | undefined) =>
  !roomId || roomId === 'all-rooms' || roomId === 'watched'

export function RoomMembersAvatars({
  roomId: roomIdProp,
  refreshKey,
  size = 'md',
  maxVisible = 4,
  className,
}: RoomMembersAvatarsProps) {
  const searchParams = useSearchParams()
  const roomId = roomIdProp !== undefined ? roomIdProp : searchParams.get('roomId')
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    if (isVirtualRoom(roomId)) {
      setMembers([])
      return
    }

    let cancelled = false
    fetch(`/api/rooms/${roomId}/members`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.members) {
          setMembers(data.members)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch room members:', err)
        if (!cancelled) setMembers([])
      })
    return () => {
      cancelled = true
    }
  }, [roomId, refreshKey])

  if (isVirtualRoom(roomId) || members.length === 0) {
    return null
  }

  return <AvatarStack users={members} maxVisible={maxVisible} size={size} className={className} />
}
