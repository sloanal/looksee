'use client'

import { DetailSection } from '@/components/MediaDetail'

export interface SubmissionInfo {
  addedBy: { id: string; name: string; imageUrl: string | null } | null
  roomName: string | null
  addedAt: string
  timezone: string | null
  recommendedByName: string | null
  recommendationContext: string | null
}

/** Either end of a recommendation: the viewer's own note, or the adder's. */
export interface RecommendationSource {
  recommendedByName?: string | null
  recommendationContext?: string | null
}

function formatAddedDate(iso: string): { short: string; full: string } | null {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return null
  return {
    short: date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
    full: date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' }),
  }
}

function nonEmpty(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Who added this title, to which room, and when. Every field is optional, so
 * this renders nothing when there is nothing to credit.
 */
export function AddedBySection({ submission }: { submission?: SubmissionInfo | null }) {
  if (!submission) return null

  const added = submission.addedAt ? formatAddedDate(submission.addedAt) : null
  const line = [
    submission.addedBy?.name,
    submission.roomName ? `to ${submission.roomName}` : null,
    added ? `on ${added.short}` : null,
  ].filter(Boolean).join(' ')
  if (!line) return null

  const tooltip = added
    ? submission.timezone ? `${added.full} · Submitted from ${submission.timezone}` : added.full
    : undefined

  return (
    <DetailSection title='Added by' testId='submission-meta'>
      <p className='text-sm text-muted-foreground' title={tooltip}>{line}</p>
    </DetailSection>
  )
}

/**
 * Who put someone onto this title. The viewer's own note comes first, since it
 * is theirs and private to them; failing that we show the note left by whoever
 * added the title, which is what the submission carries.
 */
export function RecommendedBySection({
  mine,
  submission,
}: {
  mine?: RecommendationSource | null
  submission?: SubmissionInfo | null
}) {
  const source = recommendation(mine) ?? recommendation(submission)
  if (!source) return null

  return (
    <DetailSection title='Recommended by'>
      <p className='text-sm text-muted-foreground'>
        {source.name}
        {source.context && <span className='mt-1 block text-xs italic'>{source.context}</span>}
      </p>
    </DetailSection>
  )
}

function recommendation(source?: RecommendationSource | null) {
  const name = nonEmpty(source?.recommendedByName)
  const context = nonEmpty(source?.recommendationContext)
  return name || context ? { name, context } : null
}
