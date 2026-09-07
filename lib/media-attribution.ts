export type AttributionUser = {
  id: string
  name: string
  imageUrl?: string | null
}

/**
 * "Added by" for a title as seen by one viewer. MediaItem.createdBy is the
 * global creator, who may live in a household the viewer never shares a room
 * with (titles are global per tmdbId). Only surface the creator when they are
 * visible to the viewer; otherwise credit whoever added the title to the
 * viewer's room (that MediaItemRoom.addedBy is already exposed as addedByName).
 */
export function resolveVisibleAttribution(
  item: {
    createdBy: AttributionUser
    mediaItemRooms: { roomId: string; addedBy: AttributionUser }[]
  },
  viewerUserId: string,
  visibleRoomIds: readonly string[],
  visibleMemberIds: Set<string>,
): AttributionUser | null {
  if (
    item.createdBy.id === viewerUserId ||
    visibleMemberIds.has(item.createdBy.id)
  ) {
    return item.createdBy
  }
  for (const roomId of visibleRoomIds) {
    const join = item.mediaItemRooms.find((mir) => mir.roomId === roomId)
    if (join) return join.addedBy
  }
  return null
}

/** Stored on MediaItemRoom.sourceMeta. submittedAt is always server-stamped. */
export type SourceMeta = {
  timezone?: string
  locale?: string
  submittedAt: string
  /** Set by bulk importers (e.g. 'letterboxd'); absent for hand-added titles. */
  importedFrom?: string
}

const MAX_TIMEZONE_LENGTH = 64
const MAX_LOCALE_LENGTH = 32

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > maxLength) return undefined
  return trimmed
}

/**
 * Build the per-room submission record from an untrusted request body. Only
 * timezone/locale are taken from the client (bounded, optional); the timestamp
 * is always the server clock. Never accepts location data. `trusted` fields come
 * from the route itself, not the request, so importers can stamp their source.
 */
export function buildSourceMeta(
  body: unknown,
  trusted?: { importedFrom?: string },
): SourceMeta {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const meta: SourceMeta = { submittedAt: new Date().toISOString() }
  const timezone = boundedString(input.timezone, MAX_TIMEZONE_LENGTH)
  if (timezone) meta.timezone = timezone
  const locale = boundedString(input.locale, MAX_LOCALE_LENGTH)
  if (locale) meta.locale = locale
  const importedFrom = boundedString(trusted?.importedFrom, MAX_LOCALE_LENGTH)
  if (importedFrom) meta.importedFrom = importedFrom
  return meta
}

export function parseSourceMeta(
  value: unknown,
): { timezone: string | null; submittedAt: Date | null } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { timezone: null, submittedAt: null }
  }
  const record = value as Record<string, unknown>
  const timezone = boundedString(record.timezone, MAX_TIMEZONE_LENGTH) ?? null
  let submittedAt: Date | null = null
  if (typeof record.submittedAt === 'string') {
    const parsed = new Date(record.submittedAt)
    if (!isNaN(parsed.getTime())) submittedAt = parsed
  }
  return { timezone, submittedAt }
}

export type SubmissionInfo = {
  addedBy: { id: string; name: string; imageUrl: string | null } | null
  roomName: string | null
  addedAt: string
  timezone: string | null
  recommendedByName: string | null
  recommendationContext: string | null
}

export type SubmissionJoinInput = {
  roomId: string
  createdAt: Date
  sourceMeta?: unknown
  room: { id: string; name: string }
  addedBy: AttributionUser
}

export type SubmissionPreferenceInput = {
  userId: string
  recommendedByName?: string | null
  recommendationContext?: string | null
}

function nonEmpty(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * How a title reached this viewer. The source is the viewer-visible
 * MediaItemRoom with the earliest createdAt (callers scoped to one room pass
 * only that room in visibleRoomIds). The adder is that join's addedBy, but only
 * while they are still the viewer or a current member of a visible room — a
 * user who has left is never surfaced. Recommender fields come from the adder's
 * own UserMediaPreference on the title, under the same visibility rule. With no
 * visible join (Just My Stuff) we fall back to MediaItem.createdAt and credit
 * the viewer only if they created the title.
 */
export function resolveSubmission(
  item: {
    createdAt: Date
    createdBy: AttributionUser
    mediaItemRooms: SubmissionJoinInput[]
    preferences: SubmissionPreferenceInput[]
  },
  viewerUserId: string,
  visibleRoomIds: readonly string[],
  visibleMemberIds: Set<string>,
): SubmissionInfo {
  const visibleSet = new Set(visibleRoomIds)
  const chosen = item.mediaItemRooms
    .filter((candidate) => visibleSet.has(candidate.roomId))
    .reduce<SubmissionJoinInput | null>(
      (earliest, candidate) =>
        !earliest || candidate.createdAt.getTime() < earliest.createdAt.getTime()
          ? candidate
          : earliest,
      null,
    )

  const isVisibleUser = (userId: string) => userId === viewerUserId || visibleMemberIds.has(userId)

  let adder: AttributionUser | null = null
  let roomName: string | null = null
  let addedAt = item.createdAt
  let timezone: string | null = null

  if (chosen) {
    roomName = chosen.room.name
    const meta = parseSourceMeta(chosen.sourceMeta)
    addedAt = meta.submittedAt ?? chosen.createdAt
    timezone = meta.timezone
    if (isVisibleUser(chosen.addedBy.id)) adder = chosen.addedBy
  } else if (item.createdBy.id === viewerUserId) {
    adder = item.createdBy
  }

  const adderId = adder?.id
  const adderPreference = adderId
    ? item.preferences.find((preference) => preference.userId === adderId)
    : undefined

  return {
    addedBy: adder ? { id: adder.id, name: adder.name, imageUrl: adder.imageUrl ?? null } : null,
    roomName,
    addedAt: addedAt.toISOString(),
    timezone,
    recommendedByName: nonEmpty(adderPreference?.recommendedByName),
    recommendationContext: nonEmpty(adderPreference?.recommendationContext),
  }
}

/** Response shape for create/update mutations: catalog fields only, no legacy roomId or creator. */
export function serializePublicMediaItem(item: {
  id: string
  title: string
  type: string
  tmdbId: string | null
  sourceType: string
  externalUrl: string | null
  posterUrl: string | null
  description: string | null
  genres: string
  runtimeMinutes: number | null
  rating: number | null
  releaseDate: string | null
}) {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    tmdbId: item.tmdbId,
    sourceType: item.sourceType,
    externalUrl: item.externalUrl,
    posterUrl: item.posterUrl,
    description: item.description,
    genres: item.genres,
    runtimeMinutes: item.runtimeMinutes,
    rating: item.rating,
    releaseDate: item.releaseDate,
  }
}
