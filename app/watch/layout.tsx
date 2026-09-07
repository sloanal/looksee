import { TabShell } from '@/components/TabShell'

export default function WatchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <TabShell>{children}</TabShell>
}
