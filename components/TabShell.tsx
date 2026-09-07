import { ReactNode } from 'react'
import { BottomNav } from '@/components/BottomNav'

/**
 * Shared frame for the five tab pages: cream canvas, room for the fixed
 * bottom nav (plus the iPhone home indicator), and the nav itself.
 */
export function TabShell({ children }: { children: ReactNode }) {
  return (
    <div className='min-h-screen bg-canvas bottom-nav-spacing safe-x'>
      {children}
      <BottomNav />
    </div>
  )
}
