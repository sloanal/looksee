'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

/**
 * How much of the entrance choreography a view plays (see "Page and component
 * motion" in globals.css): `build` staggers everything in, `settle` is one
 * quick fade, `still` plays nothing.
 */
export type MotionMode = 'build' | 'settle' | 'still'

/** Views already shown in this session. Only written in effects, never on the server. */
const seenViews = new Set<string>()

/**
 * `build` the first time the view `id` mounts in this session and `settle` on
 * every later visit, so a tab only builds itself in front of you once.
 *
 * The answer is fixed for the life of the component: switching modes while
 * items are on screen would restart their animations.
 */
export function useViewMotion(id: string): MotionMode {
  const [mode] = useState<MotionMode>(() => (seenViews.has(id) ? 'settle' : 'build'))
  useEffect(() => {
    seenViews.add(id)
  }, [id])
  return mode
}

/**
 * For content that reloads in place behind a skeleton (a list refetching after
 * a filter change): `build` the first time it lands, `settle` on each reload.
 *
 * Pass `true` while the content is absent from the DOM. The mode only changes
 * then, so nothing visible ever restarts.
 */
export function useReloadMotion(absent: boolean): MotionMode {
  const landed = useRef(false)
  const [mode, setMode] = useState<MotionMode>('build')
  useEffect(() => {
    if (!absent) landed.current = true
    else if (landed.current) setMode('settle')
  }, [absent])
  return mode
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown
}

/** Whether `withViewTransition` will actually animate here. */
export function canViewTransition(): boolean {
  return typeof document !== 'undefined' &&
    typeof (document as ViewTransitionDocument).startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Runs a React state update inside a native view transition, so elements that
 * share a `view-transition-name` morph between their old and new places while
 * the rest crossfades. Falls back to a plain update where unsupported or when
 * reduced motion is on.
 *
 * The transition applies the update a frame later, so anything that needs the
 * new DOM (focusing an input it renders) goes in `afterUpdate`.
 */
export function withViewTransition(update: () => void, afterUpdate?: () => void) {
  if (!canViewTransition()) {
    update()
    if (afterUpdate) requestAnimationFrame(afterUpdate)
    return
  }
  ;(document as ViewTransitionDocument).startViewTransition!(() => {
    flushSync(update)
    afterUpdate?.()
  })
}
