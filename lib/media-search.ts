import { matchQueryGroups } from '@/lib/search-normalize'

export type SearchMatchField = 'title' | 'recommender' | 'notes' | 'year'

export type SearchablePreference = {
  userId: string
  notes?: string | null
  recommendedByName?: string | null
  recommendationContext?: string | null
}

/**
 * Which fields of a title match the query, as seen by one viewer: the title, its release
 * year, the viewer's own recommender/notes/context, and the recommender name of
 * preferences belonging to members the viewer currently shares a visible room with.
 * Co-members' notes/context are private (see lib/visibility.ts) and are never matched,
 * so a search cannot reveal what they contain. Null = no match.
 */
export function matchMediaSearch(
  item: { title: string; releaseDate: string | null; preferences: SearchablePreference[] },
  search: string,
  viewerUserId: string,
  visibleMemberIds: Set<string>,
): SearchMatchField[] | null {
  const recommender: string[] = []
  const notes: string[] = []
  item.preferences.forEach((preference) => {
    const isViewer = preference.userId === viewerUserId
    if (!isViewer && !visibleMemberIds.has(preference.userId)) return
    if (preference.recommendedByName) recommender.push(preference.recommendedByName)
    if (!isViewer) return
    if (preference.notes) notes.push(preference.notes)
    if (preference.recommendationContext) notes.push(preference.recommendationContext)
  })
  const year = item.releaseDate ? item.releaseDate.slice(0, 4) : ''

  return matchQueryGroups<SearchMatchField>(
    [
      ['title', [item.title]],
      ['recommender', recommender],
      ['notes', notes],
      ['year', [year]],
    ],
    search,
  )
}

/** Excitement filters, keyed by the value Browse sends. Excitement is 1, 3 or 5. */
const EXCITEMENT_BY_FILTER: Record<string, number> = {
  not_excited: 1,
  neutral: 3,
  excited: 5,
}

/**
 * Prisma clause for the viewer's own rating state. `unrated` = no preference row or a
 * placeholder row with ratedAt null (favorite-only); `rated` is its complement.
 * The excitement filters require ratedAt, so a favorite-only placeholder (which
 * carries a neutral excitement it was never given) is not treated as neutral.
 * Unknown values yield null so callers can ignore them.
 */
export function myStatusWhere(userId: string, myStatus: string | null) {
  switch (myStatus) {
    case 'unrated':
      return { preferences: { none: { userId, ratedAt: { not: null } } } }
    case 'rated':
      return { preferences: { some: { userId, ratedAt: { not: null } } } }
    case 'have_not_seen':
    case 'already_seen':
      return { preferences: { some: { userId, status: myStatus.toUpperCase() } } }
    case 'favorites':
      return { preferences: { some: { userId, isFavorite: true } } }
    case 'not_excited':
    case 'neutral':
    case 'excited':
      return {
        preferences: {
          some: { userId, ratedAt: { not: null }, excitement: EXCITEMENT_BY_FILTER[myStatus] },
        },
      }
    default:
      return null
  }
}
