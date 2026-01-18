import { BottomNav } from '@/components/BottomNav'

export default function AddLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background bottom-nav-spacing safe-x">
      {children}
      <BottomNav />
    </div>
  )
}

