'use client'

import { cn } from '@/lib/utils'

export interface SubmissionInfo {
  addedBy: { id: string; name: string; imageUrl: string | null } | null
  roomName: string | null
  addedAt: string
  timezone: string | null
  recommendedByName: string | null
  recommendationContext: string | null
}

interface SubmissionMetaProps {
  submission?: SubmissionInfo | null
  className?: string
}

function formatAddedDate(iso: string): { short: string; full: string } | null {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return null
  return {
    short: date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
    full: date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' }),
  }
}

/**
 * Compact "who added this, where, when, and on whose recommendation" block.
 * Every field is optional; renders nothing when there is nothing to say.
 */
export function SubmissionMeta({ submission, className }: SubmissionMetaProps) {
  if (!submission) return null

  const added = submission.addedAt ? formatAddedDate(submission.addedAt) : null
  const hasAddedLine = Boolean(submission.addedBy || submission.roomName || added)
  if (!hasAddedLine && !submission.recommendedByName && !submission.recommendationContext) {
    return null
  }

  const whoWhere = [
    submission.addedBy ? `Added by ${submission.addedBy.name}` : null,
    submission.roomName ? `to ${submission.roomName}` : null,
  ].filter(Boolean).join(' ')

  const tooltip = added
    ? submission.timezone ? `${added.full} · Submitted from ${submission.timezone}` : added.full
    : undefined

  return (
    <div
      className={cn('text-xs text-muted-foreground space-y-0.5', className)}
      data-testid='submission-meta'
    >
      {hasAddedLine && (
        <p title={tooltip}>
          {whoWhere}
          {whoWhere && added ? ' · ' : ''}
          {added ? `Added ${added.short}` : ''}
        </p>
      )}
      {submission.recommendedByName && <p>Recommended by {submission.recommendedByName}</p>}
      {submission.recommendationContext && (
        <p className='italic'>“{submission.recommendationContext}”</p>
      )}
    </div>
  )
}
