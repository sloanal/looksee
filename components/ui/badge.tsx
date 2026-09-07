import { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium leading-none',
  {
    variants: {
      variant: {
        /** Neutral chip: genres, room names, hints. */
        default: 'bg-secondary text-secondary-foreground',
        /** Quiet chip with muted text (labels that explain, not classify). */
        muted: 'bg-muted text-muted-foreground',
        /** Tinted with the brand ink: roles, "On", counts. */
        primary: 'bg-primary/10 text-primary',
        /** Filled: the one thing on screen to notice (Top Pick). */
        solid: 'bg-primary text-primary-foreground',
        outline: 'border border-border bg-background text-foreground',
        favorite: 'bg-favorite/10 text-favorite',
      },
      size: {
        sm: 'h-5 px-2 text-[11px]',
        md: 'h-6 px-2.5 text-xs',
        lg: 'h-7 px-3 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode
  className?: string
  title?: string
  'aria-label'?: string
  'data-testid'?: string
}

export function Badge({ children, variant, size, className, ...rest }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...rest}>
      {children}
    </span>
  )
}

export { badgeVariants }
