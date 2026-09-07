'use client'

import { useCallback, useEffect, useState } from 'react'
import { ROOMS_CHANGED_EVENT } from '@/lib/rooms'

export interface RoomSummary {
  id: string
  name: string
  inviteCode: string
  role: string
  memberCount: number
  mediaItemCount: number
  unwatchedCount: number
}

export interface RoomsSnapshot {
  rooms: RoomSummary[]
  allRoomsCount: number
  watchedCount: number
  /** False until the first response (success or failure) has arrived. */
  loaded: boolean
}

const EMPTY: RoomsSnapshot = { rooms: [], allRoomsCount: 0, watchedCount: 0, loaded: false }

// One `/api/rooms` fetch per page load shared by every header widget, instead
// of RoomSelector and useSelectedRoomName each requesting it.
let snapshot: RoomsSnapshot = EMPTY
let inflight: Promise<void> | null = null
const listeners = new Set<(next: RoomsSnapshot) => void>()

function publish(next: RoomsSnapshot) {
  snapshot = next
  listeners.forEach((listener) => listener(next))
}

function refetchRooms(): Promise<void> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await fetch('/api/rooms')
      if (!res.ok) {
        publish({ ...snapshot, loaded: true })
        return
      }
      const data = await res.json()
      if (Array.isArray(data.rooms)) {
        publish({
          rooms: data.rooms,
          allRoomsCount: data.allRoomsCount ?? 0,
          watchedCount: data.watchedCount ?? 0,
          loaded: true,
        })
      } else {
        publish({ ...snapshot, loaded: true })
      }
    } catch (err) {
      console.error('Failed to load rooms:', err)
      publish({ ...snapshot, loaded: true })
    } finally {
      inflight = null
    }
  })()
  return inflight
}

let globalListenersAttached = false
function attachGlobalListeners() {
  if (globalListenersAttached || typeof window === 'undefined') return
  globalListenersAttached = true
  // Counts go stale after mutations elsewhere (watched, edit rooms, add, other
  // tabs), so refetch on our app event and whenever the tab regains focus.
  const refetch = () => {
    if (listeners.size > 0) refetchRooms()
  }
  window.addEventListener(ROOMS_CHANGED_EVENT, refetch)
  window.addEventListener('focus', refetch)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refetch()
  })
}

/** Rooms the signed-in user belongs to, shared across all subscribers. */
export function useRooms(): RoomsSnapshot & { refetch: () => Promise<void> } {
  const [state, setState] = useState<RoomsSnapshot>(snapshot)

  useEffect(() => {
    attachGlobalListeners()
    listeners.add(setState)
    setState(snapshot)
    refetchRooms()
    return () => {
      listeners.delete(setState)
    }
  }, [])

  const refetch = useCallback(() => refetchRooms(), [])

  return { ...state, refetch }
}
