import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: ReactNode
  description?: ReactNode
  /** Usually one `Button` or a link. */
  action?: ReactNode
  className?: string
  /** Compact spacing for inside cards/modals. */
  compact?: boolean
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-sm flex-col items-center text-center',
        compact ? 'py-6' : 'py-12',
        className,
      )}
    >
      {icon && (
        <div className='mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary'>
          <DuotoneIcon icon={icon} size={26} />
        </div>
      )}
      <h2 className='text-lg font-semibold text-foreground'>{title}</h2>
      {description && <p className='mt-1 text-sm text-muted-foreground'>{description}</p>}
      {action && <div className='mt-5 flex w-full flex-wrap justify-center gap-3'>{action}</div>}
    </div>
  )
}
