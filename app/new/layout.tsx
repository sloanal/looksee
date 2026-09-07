import { TabShell } from '@/components/TabShell'

export default function NewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <TabShell>{children}</TabShell>
}
