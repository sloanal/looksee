import { prisma } from '@/lib/prisma'

export type MediaItemRoomInput = {
  roomId: string
  addedByUserId: string
  createdAt?: Date
  sourceMeta?: unknown
  room: { id: string; name: string }
  addedBy: { id: string; name: string; imageUrl?: string | null }
}

export type PreferenceUserInput = {
  id: string
  name: string
  imageUrl: string | null
}

export type PreferenceInput = {
  userId: string
  status: string
  isWatched?: boolean
  isFavorite?: boolean
  excitement: number
  notes?: string | null
  recommendedByName?: string | null
  recommendationContext?: string | null
  ratedAt?: Date | null
  user?: PreferenceUserInput
}

export type VisibilityScope = {
  viewerUserId: string
  viewerRoomIds: readonly string[]
  /** When set, only this room is visible — never other households, and never sibling rooms. */
  focusedRoomId?: string | null
  /** Current members of rooms the viewer belongs to, keyed by roomId. */
  membersByRoomId: Map<string, Set<string>>
}

export type VisibleRoom = {
  id: string
  name: string
  addedByUserId: string
  addedByName: string
}

export type VisibleOtherPreference = {
  status: string
  excitement: number
  isWatched: boolean
  isFavorite: boolean
  ratedAt: string | null
  user: PreferenceUserInput
}

export type VisibleMyPreference = {
  status: string
  isWatched: boolean | undefined
  isFavorite: boolean
  excitement: number
  notes: string | null | undefined
  recommendedByName: string | null | undefined
  recommendationContext: string | null | undefined
  ratedAt: string | null
}

export type MediaVisibility = {
  rooms: VisibleRoom[]
  otherPreferences: VisibleOtherPreference[]
  myPreference: VisibleMyPreference | null
  visiblePreferenceCount: number
}

/** Prisma `where` for catalog items that currently belong to any of these rooms. */
export function itemsInRoomsWhere(roomIds: string[]) {
  return {
    mediaItemRooms: {
      some: {
        roomId: { in: roomIds },
      },
    },
  }
}

/** Prisma `where` for catalog items that currently belong to one room. */
export function itemsInRoomWhere(roomId: string) {
  return {
    mediaItemRooms: {
      some: { roomId },
    },
  }
}

/**
 * Personal catalog ("Just My Stuff"): titles the user has rated, plus titles
 * they created that are in no room yet. Titles are global per tmdbId, so a
 * user who rates a title first created by another household still owns it in
 * their personal catalog even though they share no room with the creator.
 * Spread these clauses into a Prisma `OR`.
 */
export function personalCatalogClauses(userId: string) {
  return [
    { preferences: { some: { userId } } },
    { createdByUserId: userId, mediaItemRooms: { none: {} } },
  ]
}

/**
 * A user may act on a title iff they created it, they have their own
 * UserMediaPreference on it (personal catalog), or they are currently a member
 * of at least one room the title belongs to (via MediaItemRoom). The legacy
 * MediaItem.roomId column is not membership and must not be used for access.
 * Losing the last shared room (leave/kick) revokes room-based access while
 * leaving the user's own preference — and therefore their personal-catalog
 * access — intact.
 */
export async function userCanAccessMediaItem(
  userId: string,
  mediaItemId: string,
): Promise<boolean> {
  const mediaItem = await prisma.mediaItem.findUnique({
    where: { id: mediaItemId },
    select: {
      createdByUserId: true,
      preferences: {
        where: { userId },
        select: { id: true },
        take: 1,
      },
      mediaItemRooms: {
        where: { room: { memberships: { some: { userId } } } },
        select: { roomId: true },
        take: 1,
      },
    },
  })

  if (!mediaItem) return false
  if (mediaItem.createdByUserId === userId) return true
  if (mediaItem.preferences.length > 0) return true
  return mediaItem.mediaItemRooms.length > 0
}

/**
 * Who may remove a title from a room (shared by DELETE /api/media/[id] and
 * PATCH /api/media/[id]/rooms): the title's creator may remove it from any room
 * they belong to; any other member may remove it only from a room where they
 * added it (MediaItemRoom.addedByUserId) or which they own. Hard deletion of
 * the global MediaItem is a separate, stricter rule owned by DELETE.
 */
export function userMayRemoveFromRoom(input: {
  userId: string
  isCreator: boolean
  addedByUserId: string
  ownedRoomIds: ReadonlySet<string>
  roomId: string
}): boolean {
  if (input.isCreator) return true
  if (input.addedByUserId === input.userId) return true
  return input.ownedRoomIds.has(input.roomId)
}

export const visibleRoomInclude = {
  room: {
    select: { id: true, name: true },
  },
  addedBy: {
    select: { id: true, name: true, imageUrl: true },
  },
} as const

export const visiblePreferenceInclude = {
  user: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
    },
  },
} as const

export async function loadMembersByRoomId(
  roomIds: string[],
): Promise<Map<string, Set<string>>> {
  const membersByRoomId = new Map<string, Set<string>>()
  if (roomIds.length === 0) {
    return membersByRoomId
  }

  const memberships = await prisma.roomMembership.findMany({
    where: { roomId: { in: roomIds } },
    select: { roomId: true, userId: true },
  })

  for (const membership of memberships) {
    let members = membersByRoomId.get(membership.roomId)
    if (!members) {
      members = new Set<string>()
      membersByRoomId.set(membership.roomId, members)
    }
    members.add(membership.userId)
  }

  return membersByRoomId
}

export function getVisibleRoomIds(
  mediaItemRooms: { roomId: string }[],
  scope: Pick<VisibilityScope, 'viewerRoomIds' | 'focusedRoomId'>,
): string[] {
  const viewerSet = new Set(scope.viewerRoomIds)
  const visible = mediaItemRooms
    .map((mir) => mir.roomId)
    .filter((roomId) => viewerSet.has(roomId))

  if (scope.focusedRoomId) {
    return visible.filter((roomId) => roomId === scope.focusedRoomId)
  }

  return visible
}

export function getVisibleMemberIds(
  visibleRoomIds: string[],
  membersByRoomId: Map<string, Set<string>>,
): Set<string> {
  const memberIds = new Set<string>()
  visibleRoomIds.forEach((roomId) => {
    const members = membersByRoomId.get(roomId)
    if (!members) return
    members.forEach((userId) => {
      memberIds.add(userId)
    })
  })
  return memberIds
}

/** Union of current members across the given rooms (typically the viewer's rooms). */
export function unionMemberIds(
  membersByRoomId: Map<string, Set<string>>,
  extraUserIds: readonly string[] = [],
): string[] {
  const memberIds = new Set<string>(extraUserIds)
  Array.from(membersByRoomId.values()).forEach((members) => {
    members.forEach((userId) => {
      memberIds.add(userId)
    })
  })
  return Array.from(memberIds)
}

export function serializeVisibleRooms(
  mediaItemRooms: MediaItemRoomInput[],
  scope: Pick<VisibilityScope, 'viewerRoomIds' | 'focusedRoomId'>,
): VisibleRoom[] {
  const visibleIds = new Set(getVisibleRoomIds(mediaItemRooms, scope))
  return mediaItemRooms
    .filter((mir) => visibleIds.has(mir.roomId))
    .map((mir) => ({
      id: mir.room.id,
      name: mir.room.name,
      addedByUserId: mir.addedByUserId,
      addedByName: mir.addedBy.name,
    }))
}

/**
 * Keep the viewer's own preference plus preferences from users who currently
 * share at least one visible room with the viewer. Does not strip notes here;
 * callers that serialize for other users must omit notes/recommender fields.
 */
export function restrictPreferencesToVisibleUsers<T extends { userId: string }>(
  preferences: T[],
  scope: VisibilityScope & { mediaItemRooms: { roomId: string }[] },
): T[] {
  const visibleRoomIds = getVisibleRoomIds(scope.mediaItemRooms, scope)
  const visibleMemberIds = getVisibleMemberIds(
    visibleRoomIds,
    scope.membersByRoomId,
  )

  return preferences.filter((preference) => {
    if (preference.userId === scope.viewerUserId) return true
    return visibleMemberIds.has(preference.userId)
  })
}

export function serializeMyPreference(
  preferences: PreferenceInput[],
  viewerUserId: string,
): VisibleMyPreference | null {
  const myPref = preferences.find((preference) => preference.userId === viewerUserId)
  if (!myPref) return null

  return {
    status: myPref.status.toLowerCase(),
    isWatched: myPref.isWatched,
    isFavorite: myPref.isFavorite === true,
    excitement: myPref.excitement,
    notes: myPref.notes,
    recommendedByName: myPref.recommendedByName,
    recommendationContext: myPref.recommendationContext,
    ratedAt: myPref.ratedAt ? myPref.ratedAt.toISOString() : null,
  }
}

export function serializeOtherPreferences(
  preferences: PreferenceInput[],
  viewerUserId: string,
  visibleMemberIds: Set<string>,
): VisibleOtherPreference[] {
  return preferences
    .filter((preference) =>
      preference.userId !== viewerUserId &&
      visibleMemberIds.has(preference.userId)
    )
    .map((preference) => ({
      status: preference.status.toLowerCase(),
      excitement: preference.excitement,
      isWatched: preference.isWatched === true,
      isFavorite: preference.isFavorite === true,
      ratedAt: preference.ratedAt ? preference.ratedAt.toISOString() : null,
      user: {
        id: preference.user?.id ?? preference.userId,
        name: preference.user?.name ?? 'Unknown',
        imageUrl: preference.user?.imageUrl ?? null,
      },
    }))
}

/**
 * Filter rooms and other-user activity for a media item.
 *
 * Visible rooms = MediaItemRoom rows in the viewer's memberships
 * (and only `focusedRoomId` when that is set).
 *
 * Visible otherPreferences = preferences whose user currently shares at least
 * one of those visible rooms with the viewer. Notes/recommender fields from
 * other users are never included.
 */
export function filterMediaVisibility(
  item: {
    mediaItemRooms: MediaItemRoomInput[]
    preferences: PreferenceInput[]
  },
  scope: VisibilityScope,
): MediaVisibility {
  const rooms = serializeVisibleRooms(item.mediaItemRooms, scope)
  const visibleMemberIds = getVisibleMemberIds(
    rooms.map((room) => room.id),
    scope.membersByRoomId,
  )
  const myPreference = serializeMyPreference(
    item.preferences,
    scope.viewerUserId,
  )
  const otherPreferences = serializeOtherPreferences(
    item.preferences,
    scope.viewerUserId,
    visibleMemberIds,
  )

  return {
    rooms,
    otherPreferences,
    myPreference,
    visiblePreferenceCount: (myPreference ? 1 : 0) + otherPreferences.length,
  }
}
