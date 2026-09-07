'use client'

import { Eye, Frown, Heart, Meh, Smile } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import { cn } from '@/lib/utils'

export interface HouseholdUser {
  id: string
  name: string
  imageUrl?: string | null
}

export interface HouseholdPreference {
  status: string
  excitement: number
  isWatched?: boolean
  isFavorite?: boolean
}

export interface HouseholdMember extends HouseholdPreference {
  user: HouseholdUser
}

interface HouseholdExcitementRowProps {
  /** The viewer's own preference; rendered first with a "You" label. */
  myPreference?: HouseholdPreference | null
  viewer?: HouseholdUser | null
  /** Already visibility-filtered by the API (room members only). */
  otherPreferences?: HouseholdMember[] | null
  className?: string
}

export function excitementIcon(excitement: number) {
  if (excitement === 1) return Frown
  if (excitement === 3) return Meh
  return Smile
}

export function excitementLabel(excitement: number): string {
  if (excitement === 1) return 'Not excited'
  if (excitement === 3) return 'Neutral'
  if (excitement === 5) return 'Excited'
  return ''
}

export function hasSeen(pref: HouseholdPreference): boolean {
  return pref.isWatched === true || pref.status.toLowerCase() === 'already_seen'
}

function MemberChip({ member, isViewer }: { member: HouseholdMember; isViewer: boolean }) {
  const seen = hasSeen(member)
  const excitement = excitementLabel(member.excitement)
  const parts = [
    isViewer ? 'You' : member.user.name,
    excitement || null,
    seen ? 'already seen' : null,
    member.isFavorite ? 'favorite' : null,
  ].filter(Boolean)
  const label = parts.join(', ')

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1.5',
        isViewer ? 'bg-primary/10' : 'bg-secondary',
      )}
      title={label}
      aria-label={label}
      data-testid={isViewer ? 'household-you' : 'household-member'}
      data-seen={seen ? 'true' : undefined}
    >
      <Avatar user={member.user} size='sm' singleInitial ring={isViewer ? 'viewer' : 'none'} />
      <DuotoneIcon
        icon={excitementIcon(member.excitement)}
        size={18}
        active
        strokeWidth={1.5}
        className={cn(seen && 'opacity-60')}
      />
      {seen && (
        <Eye
          size={12}
          className='text-muted-foreground flex-shrink-0'
          aria-hidden
          data-testid='household-seen'
        />
      )}
      {member.isFavorite && (
        <Heart size={12} className='flex-shrink-0 fill-current text-favorite' aria-hidden />
      )}
      {isViewer && (
        <span className='text-[11px] font-medium text-foreground leading-none pl-0.5'>You</span>
      )}
    </div>
  )
}

/**
 * Who in the household wants to watch this: one chip per visible member with
 * their excitement face (frown / meh / smile), an eye when they've already
 * seen it, and a heart when they favorited it. The viewer comes first.
 * Renders nothing when the viewer is the only person with an opinion.
 */
export function HouseholdExcitementRow({
  myPreference,
  viewer,
  otherPreferences,
  className,
}: HouseholdExcitementRowProps) {
  const others = otherPreferences ?? []
  if (others.length === 0) return null

  const mine: HouseholdMember | null = myPreference && viewer
    ? { ...myPreference, user: viewer }
    : null

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      data-testid='household-row'
      role='list'
      aria-label='Household excitement'
    >
      {mine && (
        <div role='listitem'>
          <MemberChip member={mine} isViewer />
        </div>
      )}
      {others.map((member) => (
        <div role='listitem' key={member.user.id}>
          <MemberChip member={member} isViewer={false} />
        </div>
      ))}
    </div>
  )
}
