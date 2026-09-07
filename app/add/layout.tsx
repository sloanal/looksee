import { TabShell } from '@/components/TabShell'

export default function AddLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <TabShell>{children}</TabShell>
}
