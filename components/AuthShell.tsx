import { ReactNode } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface AuthShellProps {
  /** Card heading, e.g. "Sign in to your account". */
  title: string
  description?: ReactNode
  /** Shows the welcome video + brand block above the card (sign in / sign up). */
  hero?: boolean
  children: ReactNode
  /** Links under the card ("Don't have an account?"). */
  footer?: ReactNode
}

/** Canvas-coloured page with a single centred card, shared by every auth screen. */
export function AuthShell({ title, description, hero = false, children, footer }: AuthShellProps) {
  return (
    <div
      className={cn(
        'flex min-h-[100dvh] flex-col items-center bg-canvas px-4 pb-8 safe-bottom',
        hero ? 'pt-4 sm:pt-8' : 'pt-10 sm:pt-16',
      )}
    >
      <div className='w-full max-w-md'>
        {hero && (
          <div className='mb-5 text-center'>
            <div className='mb-4 aspect-[16/8] w-full overflow-hidden rounded-2xl shadow-card sm:aspect-[16/7]'>
              <video
                autoPlay
                loop
                muted
                playsInline
                className='h-full w-full object-cover object-center'
              >
                <source src='/welcome.mp4' type='video/mp4' />
              </video>
            </div>
            <h1 className='text-3xl font-bold tracking-tight text-foreground'>Looksee</h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              Share and compare movies and shows with your friends and housemates
            </p>
          </div>
        )}

        <Card className='p-6 shadow-pop'>
          <h2 className={cn('font-bold text-foreground', hero ? 'text-xl' : 'text-2xl')}>
            {title}
          </h2>
          {description && <p className='mt-1 text-sm text-muted-foreground'>{description}</p>}
          <div className='mt-5'>{children}</div>
        </Card>

        {footer && (
          <div className='mt-5 space-y-2 text-center text-sm text-muted-foreground'>{footer}</div>
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
