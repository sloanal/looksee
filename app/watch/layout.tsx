import { BottomNav } from '@/components/BottomNav'
import { RoomSwitcher } from '@/components/RoomSwitcher'

export default function WatchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <RoomSwitcher />
      {children}
      <BottomNav />
    </div>
  )
}

