import { TabShell } from '@/components/TabShell'

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <TabShell>{children}</TabShell>
}
