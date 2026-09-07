import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Placeholder block with a sweeping sheen. Size it with `className` to match
 * the real content, so the layout doesn't jump when data lands.
 */
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('skeleton rounded-md bg-muted', className)} {...rest} />
}

/** Rounded bar sized like a line of text. */
export function SkeletonLine({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn('h-3 rounded-full', className)} {...rest} />
}
