'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, LogOut, Pencil, Sofa, Trash2, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MenuItem, MenuPanel, MenuTrigger } from '@/components/ui/menu'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import { RoomMembersAvatars } from '@/components/RoomMembersAvatars'
import { SettingsBadge } from '@/components/settings/SettingsCard'
import { formatTitleCount } from '@/lib/rooms'

export interface SettingsRoom {
  id: string
  name: string
  inviteCode: string
  role: string
  memberCount: number
  mediaItemCount: number
}

interface RoomCardProps {
  room: SettingsRoom
  onOpen: (room: SettingsRoom) => void
  onInvite: (room: SettingsRoom) => void
  onMembers: (room: SettingsRoom) => void
  onRename: (room: SettingsRoom) => void
  onLeave: (room: SettingsRoom) => void
  onDelete: (room: SettingsRoom) => void
}

export function RoomCard({
  room,
  onOpen,
  onInvite,
  onMembers,
  onRename,
  onLeave,
  onDelete,
}: RoomCardProps) {
  const isOwner = room.role === 'owner'
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  const runMenuAction = (action: () => void) => {
    setMenuOpen(false)
    action()
  }

  const memberLabel = `${room.memberCount} ${room.memberCount === 1 ? 'member' : 'members'}`

  return (
    <Card as='article' padded={false} className='relative' aria-label={room.name}>
      <div className='p-4 pb-3'>
        <div className='flex min-w-0 items-center gap-2 pr-10'>
          <DuotoneIcon icon={Sofa} size={18} className='flex-shrink-0' />
          <h3 className='truncate text-lg font-semibold text-foreground'>{room.name}</h3>
          <SettingsBadge variant={isOwner ? 'primary' : 'muted'} className='flex-shrink-0'>
            {isOwner ? 'Owner' : 'Member'}
          </SettingsBadge>
        </div>

        <div className='mt-2 flex items-center gap-3'>
          <button
            type='button'
            onClick={() => onMembers(room)}
            aria-label={`View members of ${room.name}`}
            className='-mx-1 flex min-h-[44px] items-center gap-2 rounded-md px-1 transition-colors hover:bg-accent'
          >
            <RoomMembersAvatars roomId={room.id} refreshKey={room.memberCount} />
            <span className='text-sm text-muted-foreground'>{memberLabel}</span>
          </button>
          <span className='text-muted-foreground/60' aria-hidden>
            ·
          </span>
          <span className='text-sm tabular-nums text-muted-foreground'>
            {formatTitleCount(room.mediaItemCount)}
          </span>
        </div>
      </div>

      <div className='absolute right-1 top-1' ref={menuRef} data-menu-container>
        <MenuTrigger
          label={`More actions for ${room.name}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        />
        {menuOpen && (
          <MenuPanel>
            {isOwner && (
              <MenuItem icon={Pencil} onClick={() => runMenuAction(() => onRename(room))}>
                Rename room
              </MenuItem>
            )}
            {isOwner
              ? (
                <MenuItem
                  icon={Trash2}
                  destructive
                  onClick={() => runMenuAction(() => onDelete(room))}
                >
                  Delete room
                </MenuItem>
              )
              : (
                <MenuItem
                  icon={LogOut}
                  destructive
                  onClick={() => runMenuAction(() => onLeave(room))}
                >
                  Leave room
                </MenuItem>
              )}
          </MenuPanel>
        )}
      </div>

      <div className='flex items-center gap-1 rounded-b-xl border-t border-border bg-muted/60 px-2 py-1.5'>
        <Button type='button' variant='ghost' onClick={() => onInvite(room)} className='px-3'>
          <UserPlus className='h-4 w-4' />
          Invite
        </Button>
        <Button type='button' variant='ghost' onClick={() => onMembers(room)} className='px-3'>
          <Users className='h-4 w-4' />
          Members
        </Button>
        <Button
          type='button'
          variant='ghost'
          onClick={() => onOpen(room)}
          className='ml-auto px-3 text-primary hover:text-primary'
        >
          Open
          <ArrowRight className='h-4 w-4' />
        </Button>
      </div>
    </Card>
  )
}
