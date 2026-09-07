import { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type NoticeVariant = 'error' | 'info' | 'success'

const variantClassName: Record<NoticeVariant, string> = {
  error: 'border-destructive/25 bg-destructive/10 text-destructive',
  info: 'border-border bg-secondary text-secondary-foreground',
  success: 'border-primary/20 bg-primary/5 text-foreground',
}

const variantIcon = {
  error: AlertCircle,
  info: Info,
  success: CheckCircle2,
}

interface NoticeProps {
  children: ReactNode
  variant?: NoticeVariant
  className?: string
}

/** Boxed inline message (form errors, dev hints, confirmations). */
export function Notice({ children, variant = 'info', className }: NoticeProps) {
  const Icon = variantIcon[variant]
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-snug',
        variantClassName[variant],
        className,
      )}
    >
      <Icon className='mt-0.5 h-4 w-4 flex-shrink-0' aria-hidden />
      <div className='min-w-0 flex-1'>{children}</div>
    </div>
  )
}
