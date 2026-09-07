'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { cn, getAvatarColor } from '@/lib/utils'

export interface AvatarUser {
  id?: string | null
  name?: string | null
  imageUrl?: string | null
}

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const sizeClassName: Record<AvatarSize, string> = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-xs',
  lg: 'h-11 w-11 text-sm',
  xl: 'h-24 w-24 text-3xl',
}

const sizePx: Record<AvatarSize, number> = { xs: 20, sm: 24, md: 32, lg: 44, xl: 96 }

export function avatarInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?'
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

interface AvatarProps {
  user: AvatarUser
  size?: AvatarSize
  /** Single initial instead of two (tight chips). */
  singleInitial?: boolean
  /** Ring around the avatar (e.g. the viewer, or stacked overlap borders). */
  ring?: 'none' | 'viewer' | 'background' | 'card'
  className?: string
  title?: string
}

/**
 * Round user avatar with a colored-initials fallback. The fallback also kicks
 * in when the image fails to load.
 */
export function Avatar({
  user,
  size = 'md',
  singleInitial = false,
  ring = 'none',
  className,
  title,
}: AvatarProps) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [user.imageUrl])

  const showImage = Boolean(user.imageUrl) && !failed
  const name = user.name || ''
  const initials = singleInitial ? (name.charAt(0) || '?').toUpperCase() : avatarInitials(name)

  return (
    <div
      className={cn(
        'relative inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-white',
        sizeClassName[size],
        ring === 'viewer' && 'ring-2 ring-primary ring-offset-1 ring-offset-card',
        ring === 'background' && 'ring-2 ring-background',
        ring === 'card' && 'ring-2 ring-card',
        className,
      )}
      title={title ?? name}
      style={showImage ? undefined : { backgroundColor: getAvatarColor(user.id || name || 'user') }}
    >
      {showImage
        ? (
          <Image
            src={user.imageUrl as string}
            alt={name}
            width={sizePx[size]}
            height={sizePx[size]}
            className='h-full w-full object-cover'
            unoptimized
            onError={() => setFailed(true)}
          />
        )
        : <span aria-hidden>{initials}</span>}
    </div>
  )
}

interface AvatarStackProps {
  users: AvatarUser[]
  maxVisible?: number
  size?: 'sm' | 'md'
  className?: string
}

/** Overlapping avatars with a "+N" tail. */
export function AvatarStack({ users, maxVisible = 4, size = 'md', className }: AvatarStackProps) {
  if (users.length === 0) return null
  const visible = users.slice(0, maxVisible)
  const hidden = users.length - visible.length
  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {visible.map((user, index) => (
        <Avatar
          key={user.id ?? `${user.name}-${index}`}
          user={user}
          size={size}
          singleInitial
          ring='background'
        />
      ))}
      {hidden > 0 && (
        <div
          className={cn(
            'relative flex flex-shrink-0 items-center justify-center rounded-full bg-muted font-medium text-foreground ring-2 ring-background',
            sizeClassName[size],
          )}
          title={`${hidden} more member${hidden !== 1 ? 's' : ''}`}
        >
          +{hidden}
        </div>
      )}
    </div>
  )
}
