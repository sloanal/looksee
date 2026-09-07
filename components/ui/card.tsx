import { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** The single card surface used by media cards, Settings cards and Watch results. */
export const cardClassName =
  'rounded-xl border border-border bg-card text-card-foreground shadow-card'

type CardVariant = 'default' | 'highlighted' | 'interactive'

const variantClassName: Record<CardVariant, string> = {
  default: '',
  highlighted: 'border-primary/70 ring-1 ring-primary/70',
  interactive: 'cursor-pointer transition-shadow hover:shadow-pop active:shadow-card',
}

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  variant?: CardVariant
  /** Default `p-4`. Set false when bands or media run edge to edge. */
  padded?: boolean
  children: ReactNode
}

export function Card({
  as: Component = 'div',
  variant = 'default',
  padded = true,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Component
      className={cn(cardClassName, variantClassName[variant], padded && 'p-4', className)}
      data-card
      {...rest}
    >
      {children}
    </Component>
  )
}

interface CardBandProps extends HTMLAttributes<HTMLDivElement> {
  /** Which edge of a padded card the band hugs. */
  position: 'top' | 'bottom'
  children: ReactNode
}

/**
 * Tinted strip that runs edge to edge inside a padded (`p-4`) card, e.g. the
 * room chips above a title or the ratings row beneath it.
 */
export function CardBand({ position, className, children, ...rest }: CardBandProps) {
  return (
    <div
      className={cn(
        '-mx-4 bg-muted/60 px-4',
        position === 'top' && '-mt-4 mb-3 rounded-t-xl border-b border-border py-2',
        position === 'bottom' && '-mb-4 mt-3 rounded-b-xl border-t border-border py-1.5',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
