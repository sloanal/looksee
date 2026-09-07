'use client'

import { LogIn, Plus, Sofa } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { RoomCard, SettingsRoom } from '@/components/settings/RoomCard'
import { SettingsCard } from '@/components/settings/SettingsCard'

interface RoomsSectionProps {
  rooms: SettingsRoom[]
  onCreate: () => void
  onJoin: () => void
  onOpen: (room: SettingsRoom) => void
  onInvite: (room: SettingsRoom) => void
  onMembers: (room: SettingsRoom) => void
  onRename: (room: SettingsRoom) => void
  onLeave: (room: SettingsRoom) => void
  onDelete: (room: SettingsRoom) => void
}

export function RoomsSection({
  rooms,
  onCreate,
  onJoin,
  onOpen,
  onInvite,
  onMembers,
  onRename,
  onLeave,
  onDelete,
}: RoomsSectionProps) {
  const actions = (
    <div className='grid grid-cols-2 gap-3 sm:flex sm:justify-end'>
      <Button type='button' onClick={onCreate} className='sm:min-w-[150px]'>
        <Plus className='h-4 w-4' />
        Create room
      </Button>
      <Button type='button' onClick={onJoin} variant='outline' className='sm:min-w-[150px]'>
        <LogIn className='h-4 w-4' />
        Join room
      </Button>
    </div>
  )

  if (rooms.length === 0) {
    return (
      <SettingsCard>
        <EmptyState
          icon={Sofa}
          title='No rooms yet'
          description='Rooms are where your household shares and rates titles together. Create one, or join a room with an invite code.'
          action={<div className='w-full max-w-sm'>{actions}</div>}
        />
      </SettingsCard>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-sm text-muted-foreground'>
          {rooms.length === 1 ? "You're in 1 room." : `You're in ${rooms.length} rooms.`}
        </p>
        {actions}
      </div>

      <ul className='space-y-4'>
        {rooms.map((room) => (
          <li key={room.id}>
            <RoomCard
              room={room}
              onOpen={onOpen}
              onInvite={onInvite}
              onMembers={onMembers}
              onRename={onRename}
              onLeave={onLeave}
              onDelete={onDelete}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
