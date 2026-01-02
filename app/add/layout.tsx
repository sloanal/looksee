import { BottomNav } from '@/components/BottomNav'
import { RoomSwitcher } from '@/components/RoomSwitcher'

export default function AddLayout({
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

