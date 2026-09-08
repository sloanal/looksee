import { ReactNode } from 'react'
import { BottomNav } from '@/components/BottomNav'
import { cn } from '@/lib/utils'

interface TabShellProps {
  children: ReactNode
  /**
   * Pin the page to the viewport instead of letting it grow: the tab owns the
   * space between its header and the nav and scrolls inside it (the New deck).
   */
  fill?: boolean
}

/**
 * Shared frame for the five tab pages: cream canvas, room for the fixed
 * bottom nav (plus the iPhone home indicator), and the nav itself.
 */
export function TabShell({ children, fill = false }: TabShellProps) {
  return (
    <div
      className={cn(
        'bg-canvas safe-x',
        // The fill layout owns a fixed viewport slice and scrolls internally, so
        // its content should run flush to the nav rather than leaving the extra
        // breathing room a normal scrolling page wants at its very end.
        fill
          ? 'flex h-[100dvh] flex-col overflow-hidden bottom-nav-flush'
          : 'min-h-screen bottom-nav-spacing',
      )}
    >
      {children}
      <BottomNav />
    </div>
  )
}
