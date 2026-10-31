'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { MotionMode, useViewMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface MotionScopeProps {
  /** Session-unique name for the view, e.g. `add:confirm`. */
  id: string
  children: ReactNode
  /** Defaults to `contents`, so the wrapper adds no box of its own. */
  className?: string
  /** Force a mode instead of the first-visit / revisit default. */
  mode?: MotionMode
}

/**
 * Wraps a view so its entrances build in the first time it's shown this
 * session and simply fade in on later visits.
 */
export function MotionScope({ id, children, className, mode }: MotionScopeProps) {
  const visitMode = useViewMotion(id)
  return (
    <div data-motion={mode ?? visitMode} className={cn(className ?? 'contents')}>
      {children}
    </div>
  )
}

/** `MotionScope` keyed by the current route, for page shells. */
export function RouteMotion({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return <MotionScope id={`route:${pathname}`}>{children}</MotionScope>
}
