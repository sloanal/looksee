import type { ReactNode } from 'react'
import { AuthEntryShell } from '@/components/marketing/AuthEntryShell'

/**
 * Sign in and sign up share this layout, so the brand panel stays put and the
 * tab indicator glides between them instead of the whole page reloading.
 */
export default function AuthEntryLayout({ children }: { children: ReactNode }) {
  return <AuthEntryShell>{children}</AuthEntryShell>
}
