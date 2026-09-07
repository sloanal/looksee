import { Film, Link as LinkIcon, LucideIcon, Tv, Video } from 'lucide-react'
import type { SubmissionInfo } from '@/components/SubmissionMeta'
import type { HouseholdMember } from '@/components/HouseholdExcitementRow'

export interface QueueItem {
  id: string
  title: string
  type: string
  posterUrl?: string
  description?: string
  genres: string[]
  releaseDate?: string
  runtimeMinutes?: number | null
  rating?: number
  createdBy: string
  createdByUserId?: string
  createdByImageUrl?: string | null
  roomId: string
  roomName: string
  tmdbId?: string | null
  sourceType?: string
  rooms?: Array<{
    id: string
    name: string
    addedByUserId: string
    addedByName: string
  }>
  myPreference?: {
    status: string
    excitement: number
    isFavorite?: boolean
  } | null
  otherPreferences?: HouseholdMember[]
  submission?: SubmissionInfo | null
}

/** Which way a card leaves the deck, and therefore what it is rated. */
export type SwipeDirection = 'left' | 'down' | 'right'

/** Swipe directions map onto the existing three-value excitement scale. */
export const EXCITEMENT_BY_DIRECTION: Record<SwipeDirection, number> = {
  left: 1,
  down: 3,
  right: 5,
}

export function getTypeIcon(type: string): LucideIcon {
  const normalized = type.toLowerCase()
  if (normalized === 'show' || normalized === 'tv' || normalized === 'shows') return Tv
  if (normalized === 'video' || normalized === 'videos') return Video
  if (normalized === 'link' || normalized === 'links') return LinkIcon
  return Film
}

export const favoritedByNames = (item: QueueItem): string[] =>
  (item.otherPreferences ?? []).filter((preference) => preference.isFavorite).map((preference) =>
    preference.user.name
  )
