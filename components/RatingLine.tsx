'use client'

import { Heart, Pencil } from 'lucide-react'
import { Avatar, AvatarUser } from '@/components/ui/avatar'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import { excitementIcon } from '@/components/HouseholdExcitementRow'
import { cn } from '@/lib/utils'

export const getStatusLabel = (status?: string) => {
  if (!status) return 'Unrated'
  const normalizedStatus = status.toLowerCase()
  const labels: Record<string, string> = {
    have_not_seen: 'Have not seen',
    already_seen: 'Already seen',
    // Handle old status values that might still exist
    not_seen_want: 'Have not seen',
    not_seen_dont_want: 'Have not seen',
    seen_would_rewatch: 'Already seen',
    seen_wont_rewatch: 'Already seen',
  }
  return labels[normalizedStatus] || 'Unrated'
}

export const getExcitementLabel = (excitement?: number) => {
  if (!excitement || (excitement !== 1 && excitement !== 3 && excitement !== 5)) return ''
  const labels: Record<number, string> = {
    1: 'Not excited',
    3: 'Neutral',
    5: 'Excited',
  }
  return labels[excitement] || ''
}

interface RatingLineProps {
  user: AvatarUser
  excitement: number
  status: string
  isFavorite?: boolean
  /** Highlights the viewer's own row. */
  isViewer?: boolean
  /** When set, the row is a button (the viewer editing their rating). */
  onClick?: () => void
  className?: string
}

/** One "avatar · face · Excited, Have not seen" line in a card's ratings band. */
export function RatingLine({
  user,
  excitement,
  status,
  isFavorite,
  isViewer = false,
  onClick,
  className,
}: RatingLineProps) {
  const excitementText = getExcitementLabel(excitement)
  const content = (
    <>
      <Avatar user={user} size='sm' singleInitial ring={isViewer ? 'viewer' : 'none'} />
      <DuotoneIcon icon={excitementIcon(excitement)} size={18} active strokeWidth={1.5} />
      <span className='min-w-0 flex-1 truncate text-sm text-foreground'>
        {excitementText ? `${excitementText}, ` : null}
        {getStatusLabel(status)}
      </span>
      {isFavorite && (
        <Heart
          size={14}
          className='flex-shrink-0 fill-current text-favorite'
          aria-label={`${user.name ?? 'Someone'} favorited this`}
        />
      )}
    </>
  )

  if (onClick) {
    return (
      <button
        type='button'
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        aria-label='Edit your rating'
        className={cn(
          '-mx-2 flex min-h-[36px] w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-accent',
          className,
        )}
      >
        {content}
        <DuotoneIcon icon={Pencil} size={14} className='flex-shrink-0 text-muted-foreground' />
      </button>
    )
  }

  return (
    <div className={cn('flex min-h-[36px] items-center gap-2 py-1', className)}>
      {content}
    </div>
  )
}
