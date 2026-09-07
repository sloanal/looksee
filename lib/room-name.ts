export const ROOM_NAME_MAX_LENGTH = 60

export type RoomNameValidation = { ok: true; name: string } | { ok: false; error: string }

export function validateRoomName(raw: unknown): RoomNameValidation {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, error: 'Room name is required' }
  }
  const name = raw.trim()
  if (name.length > ROOM_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Room name must be ${ROOM_NAME_MAX_LENGTH} characters or fewer`,
    }
  }
  return { ok: true, name }
}
