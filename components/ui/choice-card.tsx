import { ChevronRight, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChoiceCardProps {
  icon?: LucideIcon
  title: string
  description?: string
  /** Filled primary treatment for the recommended choice. */
  primary?: boolean
  /** Borderless, quieter treatment for "skip"-style choices. */
  subtle?: boolean
  onClick: () => void
  className?: string
}

/** Big tappable card for one option in a short decision step (Watch who-step, room setup). */
export function ChoiceCard({
  icon: Icon,
  title,
  description,
  primary = false,
  subtle = false,
  onClick,
  className,
}: ChoiceCardProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'flex min-h-[72px] w-full items-center gap-4 rounded-2xl border p-4 text-left transition-[transform,background-color] active:scale-[0.99]',
        primary &&
          'border-primary bg-primary text-primary-foreground shadow-card hover:bg-primary/90',
        !primary && !subtle && 'border-border bg-card text-foreground shadow-card hover:bg-accent',
        subtle && 'border-transparent bg-transparent text-foreground hover:bg-accent',
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full',
            primary ? 'bg-primary-foreground/15' : 'bg-secondary',
          )}
        >
          <Icon className='h-6 w-6' aria-hidden />
        </span>
      )}
      <span className='min-w-0 flex-1'>
        <span className='block text-lg font-semibold leading-tight'>{title}</span>
        {description && (
          <span
            className={cn(
              'mt-1 block text-sm',
              primary ? 'text-primary-foreground/80' : 'text-muted-foreground',
            )}
          >
            {description}
          </span>
        )}
      </span>
      <ChevronRight className='h-5 w-5 flex-shrink-0 opacity-60' aria-hidden />
    </button>
  )
}
