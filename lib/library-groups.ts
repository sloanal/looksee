/**
 * The slices of a person's own library that can be copied into a room in one
 * go (the "Add your titles" prompt shown after creating or joining a room).
 *
 * Group membership is decided from the caller's own MediaItem + their single
 * UserMediaPreference on it, so the same rules run on the server (counting and
 * importing) and in the browser (the manual checklist). Groups overlap freely;
 * callers dedupe by media item id.
 */

/** How many titles the manual checklist can show; group counts stay exact past it. */
export const LIBRARY_PICK_LIMIT = 500

export const LIBRARY_GROUP_KEYS = [
  'want_to_watch',
  'excited',
  'favorites',
  'seen',
  'added',
] as const

export type LibraryGroupKey = typeof LIBRARY_GROUP_KEYS[number]

export type LibraryGroup = {
  key: LibraryGroupKey
  label: string
  description: string
}

export const LIBRARY_GROUPS: readonly LibraryGroup[] = [
  {
    key: 'want_to_watch',
    label: 'Things you want to watch',
    description: 'Everything you have not seen yet',
  },
  {
    key: 'excited',
    label: "Things you're excited about",
    description: 'Only the ones you marked excited',
  },
  {
    key: 'favorites',
    label: 'Your favorites',
    description: 'Everything you hearted',
  },
  {
    key: 'seen',
    label: "Things you've already seen",
    description: 'So the room knows what you can talk about or rewatch',
  },
  {
    key: 'added',
    label: "Everything you've added",
    description: 'Every title you put into Looksee yourself',
  },
]

/** The caller's side of one title: their preference on it, if any, plus authorship. */
export type LibraryItemFacts = {
  createdByMe: boolean
  preference: {
    status: string
    isWatched: boolean
    isFavorite: boolean
    excitement: number
  } | null
}

const EXCITED_EXCITEMENT = 5

/** Which groups a title falls into for the person whose facts these are. */
export function libraryItemGroups(facts: LibraryItemFacts): LibraryGroupKey[] {
  const { createdByMe, preference } = facts
  const groups: LibraryGroupKey[] = []

  const unrated = preference === null
  const seen = preference !== null &&
    (preference.status.toUpperCase() === 'ALREADY_SEEN' || preference.isWatched)

  // A title someone added but never rated is still something they want to see.
  if ((createdByMe && unrated) || (preference !== null && !seen)) {
    groups.push('want_to_watch')
  }
  if (preference !== null && !seen && preference.excitement >= EXCITED_EXCITEMENT) {
    groups.push('excited')
  }
  if (preference?.isFavorite) {
    groups.push('favorites')
  }
  if (seen) {
    groups.push('seen')
  }
  if (createdByMe) {
    groups.push('added')
  }

  return groups
}

export function isLibraryGroupKey(value: unknown): value is LibraryGroupKey {
  return typeof value === 'string' &&
    (LIBRARY_GROUP_KEYS as readonly string[]).includes(value)
}

/** Read a `groups` request field, dropping anything unknown and any repeats. */
export function parseLibraryGroups(value: unknown): LibraryGroupKey[] {
  if (!Array.isArray(value)) return []
  return LIBRARY_GROUP_KEYS.filter((key) => value.includes(key))
}
