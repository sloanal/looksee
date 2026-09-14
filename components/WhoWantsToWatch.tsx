'use client'

import { Eye, Heart, Meh } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import {
  excitementIcon,
  hasSeen,
  HouseholdMember,
  HouseholdPreference,
  HouseholdUser,
} from '@/components/HouseholdExcitementRow'
import { cn } from '@/lib/utils'

interface WhoWantsToWatchProps {
  /** The viewer's own preference; listed first, labelled as them. */
  myPreference?: HouseholdPreference | null
  viewer?: HouseholdUser | null
  /** Already visibility-filtered by the API (room members only). */
  otherPreferences?: HouseholdMember[] | null
  className?: string
}

const isRatedExcitement = (excitement: number) =>
  excitement === 1 || excitement === 3 || excitement === 5

function excitementClause(excitement: number, isViewer: boolean): string {
  if (excitement === 5) return isViewer ? "You're excited to watch it" : 'Excited to watch it'
  if (excitement === 3) {
    return isViewer ? "You're neutral about watching it" : 'Neutral about watching it'
  }
  if (excitement === 1) {
    return isViewer ? "You're not excited to watch it" : 'Not excited to watch it'
  }
  return isViewer ? "You haven't said how excited you are" : "Hasn't said how excited they are"
}

function seenClause(seen: boolean, isViewer: boolean): string {
  if (seen) return isViewer ? "you've already seen it" : 'has already seen it'
  return isViewer ? "you haven't seen it yet" : "hasn't seen it yet"
}

/** e.g. "Excited to watch it, and hasn't seen it yet." */
function ratingSentence(member: HouseholdPreference, isViewer: boolean): string {
  return `${excitementClause(member.excitement, isViewer)}, and ${
    seenClause(hasSeen(member), isViewer)
  }.`
}

function PersonRow({ member, isViewer }: { member: HouseholdMember; isViewer: boolean }) {
  const seen = hasSeen(member)
  const rated = isRatedExcitement(member.excitement)

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-xl px-2 py-2',
        isViewer ? 'bg-primary/5' : 'bg-secondary/40',
      )}
      data-testid={isViewer ? 'who-wants-you' : 'who-wants-member'}
      data-seen={seen ? 'true' : undefined}
    >
      <Avatar user={member.user} size='md' ring={isViewer ? 'viewer' : 'none'} />
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
          <span className='break-words text-sm font-semibold text-foreground'>
            {member.user.name}
          </span>
          {isViewer && (
            <span className='rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary'>
              You
            </span>
          )}
          {member.isFavorite && (
            <span className='inline-flex items-center gap-1 text-xs font-medium text-favorite'>
              <Heart size={12} className='fill-current' aria-hidden />
              {isViewer ? 'One of your favorites' : 'One of their favorites'}
            </span>
          )}
        </div>
        <div className='mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground'>
          <span className='flex flex-shrink-0 items-center gap-1'>
            <DuotoneIcon
              icon={rated ? excitementIcon(member.excitement) : Meh}
              size={16}
              active={rated}
              strokeWidth={1.5}
            />
            {seen && <Eye size={14} aria-hidden />}
          </span>
          <span className='min-w-0 flex-1'>{ratingSentence(member, isViewer)}</span>
        </div>
      </div>
    </li>
  )
}

/**
 * Who in the household wants to watch this, spelled out: full name plus
 * excitement and seen/not-seen in words, one row per person, viewer first.
 * The card chips are deliberately terse, so the overlay is where names and
 * wording get room to breathe. Unlike the chips this always renders, saying
 * plainly when nobody (or nobody but the viewer) has weighed in.
 */
export function WhoWantsToWatch({
  myPreference,
  viewer,
  otherPreferences,
  className,
}: WhoWantsToWatchProps) {
  const others = otherPreferences ?? []
  const mine: HouseholdMember | null = myPreference && viewer
    ? { ...myPreference, user: viewer }
    : null
  const isEmpty = !mine && others.length === 0

  return (
    <section className={className} data-testid='who-wants-to-watch'>
      <h3 className='mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
        Who wants to watch
      </h3>
      {isEmpty
        ? (
          <p className='px-2 text-sm text-muted-foreground'>
            Nobody has said how they feel about this one yet.
          </p>
        )
        : (
          <>
            <ul className='space-y-1.5' aria-label='Who wants to watch'>
              {mine && <PersonRow member={mine} isViewer />}
              {others.map((member) => (
                <PersonRow key={member.user.id} member={member} isViewer={false} />
              ))}
            </ul>
            {others.length === 0 && (
              <p className='mt-2 px-2 text-sm text-muted-foreground'>
                Nobody else has weighed in on this one yet.
              </p>
            )}
            {!mine && (
              <p className='mt-2 px-2 text-sm text-muted-foreground'>
                You haven&apos;t rated this one yet.
              </p>
            )}
          </>
        )}
    </section>
  )
}
