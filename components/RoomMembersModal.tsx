'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Modal, ModalBody, ModalHeader } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { Skeleton, SkeletonLine } from '@/components/ui/skeleton'
import { ConfirmModal } from '@/components/settings/ConfirmModal'
import { SettingsBadge } from '@/components/settings/SettingsCard'

interface Member {
  id: string
  name: string
  imageUrl: string | null
  role: string
}

interface RoomMembersModalProps {
  isOpen: boolean
  onClose: () => void
  roomId: string | null
  roomName: string
  /** Fires after a member is removed so the page can refresh its counts. */
  onMembersChanged?: () => void
}

export function RoomMembersModal({
  isOpen,
  onClose,
  roomId,
  roomName,
  onMembersChanged,
}: RoomMembersModalProps) {
  const open = isOpen && roomId !== null

  return (
    <Modal isOpen={open} onClose={onClose} aria-label={`Members of ${roomName}`}>
      {isOpen && roomId !== null && (
        <MembersBody
          key={roomId}
          roomId={roomId}
          roomName={roomName}
          onMembersChanged={onMembersChanged}
        />
      )}
    </Modal>
  )
}

interface MembersBodyProps {
  roomId: string
  roomName: string
  onMembersChanged?: () => void
}

function MembersBody({ roomId, roomName, onMembersChanged }: MembersBodyProps) {
  const { data: session } = useSession()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<Member | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string>('member')

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/rooms/${roomId}/members`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Couldn't load members")
        setMembers([])
        return
      }
      setMembers(data.members ?? [])
      if (data.currentUserRole) {
        setCurrentUserRole(data.currentUserRole)
      }
    } catch (err) {
      console.error('Failed to fetch room members:', err)
      setError("Couldn't load members")
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const removeMember = async (member: Member): Promise<string | void> => {
    setError('')
    setRemovingUserId(member.id)
    try {
      const response = await fetch(`/api/rooms/${roomId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return data.error || 'Failed to remove member'
      }

      await fetchMembers()
      onMembersChanged?.()
    } catch (err) {
      console.error('Failed to remove member:', err)
      return 'Failed to remove member'
    } finally {
      setRemovingUserId(null)
    }
  }

  return (
    <>
      <ModalHeader
        title='Members'
        description={<span className='block truncate'>{roomName}</span>}
      />
      <ModalBody className='pb-5 sm:pb-6'>
        {error && <Notice variant='error' className='mb-3'>{error}</Notice>}

        {loading
          ? (
            <div className='-mx-2 space-y-3 py-2' role='status' aria-live='polite'>
              {[0, 1, 2].map((i) => (
                <div key={i} className='flex items-center gap-3 px-2'>
                  <Skeleton className='h-10 w-10 flex-shrink-0 rounded-full' />
                  <div className='min-w-0 flex-1 space-y-1.5'>
                    <SkeletonLine className='w-32' />
                    <SkeletonLine className='w-20' />
                  </div>
                </div>
              ))}
              <span className='sr-only'>Loading members</span>
            </div>
          )
          : members.length === 0
          ? <div className='py-8 text-center text-sm text-muted-foreground'>No members found</div>
          : (
            <ul className='-mx-2 divide-y divide-border'>
              {members.map((member) => {
                const isCurrentUser = session?.user?.id === member.id
                const canRemove = currentUserRole === 'owner' && !isCurrentUser

                return (
                  <li key={member.id} className='flex items-center gap-3 px-2 py-3'>
                    <Avatar
                      user={member}
                      size='lg'
                      singleInitial
                      ring={isCurrentUser ? 'viewer' : 'none'}
                    />
                    <div className='min-w-0 flex-1'>
                      <div className='flex min-w-0 items-center gap-2'>
                        <p className='truncate font-medium text-foreground'>
                          {member.name}
                          {isCurrentUser && (
                            <span className='font-normal text-muted-foreground'>{' '}(you)</span>
                          )}
                        </p>
                        {member.role === 'owner' && (
                          <SettingsBadge className='flex-shrink-0'>Owner</SettingsBadge>
                        )}
                      </div>
                    </div>
                    {canRemove && (
                      <Button
                        type='button'
                        variant='outline-destructive'
                        size='sm'
                        onClick={() => setPendingRemove(member)}
                        disabled={removingUserId === member.id}
                        className='h-10'
                      >
                        {removingUserId === member.id ? 'Removing...' : 'Remove'}
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
      </ModalBody>

      <ConfirmModal
        open={pendingRemove !== null}
        title={pendingRemove ? `Remove ${pendingRemove.name}?` : ''}
        description={
          <p>
            They&apos;ll lose access to {roomName}{' '}
            and its titles. They can rejoin later with the invite code.
          </p>
        }
        confirmLabel='Remove'
        busyLabel='Removing…'
        destructive
        onConfirm={() => (pendingRemove ? removeMember(pendingRemove) : undefined)}
        onClose={() => setPendingRemove(null)}
      />
    </>
  )
}
