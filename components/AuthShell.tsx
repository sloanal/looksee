import { ReactNode } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Logo } from '@/components/marketing/Logo'

interface AuthShellProps {
  /** Card heading, e.g. "Reset your password". */
  title: string
  description?: ReactNode
  children: ReactNode
  /** Links under the card ("Remembered it?"). */
  footer?: ReactNode
}

/**
 * Canvas-coloured page with a single centred card, for the account screens
 * that aren't sign in / sign up (those have their own split layout in
 * app/auth/(entry)): password reset and room setup.
 */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className='flex min-h-[100dvh] flex-col items-center bg-canvas px-4 pb-8 pt-8 safe-bottom sm:pt-12'>
      <div className='w-full max-w-md'>
        <div className='motion-fade mb-8 flex justify-center'>
          <Logo />
        </div>

        <Card className='motion-rise p-6 shadow-pop [--i:1]'>
          <h2 className='text-2xl font-bold text-foreground'>{title}</h2>
          {description && <p className='mt-1 text-sm text-muted-foreground'>{description}</p>}
          <div className='mt-5'>{children}</div>
        </Card>

        {footer && (
          <div className='motion-fade mt-5 space-y-2 text-center text-sm text-muted-foreground [--i:2]'>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className='font-medium text-foreground underline-offset-4 hover:underline'>
      {children}
    </Link>
  )
}
