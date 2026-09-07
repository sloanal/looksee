/**
 * Fired on `window` after any mutation that can change room membership or the
 * per-room title counts shown in RoomSelector (add/remove title, edit rooms,
 * mark watched/unwatched, delete, rate). RoomSelector refetches on it.
 */
export const ROOMS_CHANGED_EVENT = 'looksee:rooms-changed'

export function notifyRoomsChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(ROOMS_CHANGED_EVENT))
}

export function formatTitleCount(count: number): string {
  return `${count} ${count === 1 ? 'title' : 'titles'}`
}
