'use client'

import { ArrowLeft } from 'lucide-react'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import { cn } from '@/lib/utils'

interface BackButtonProps {
  onClick: () => void
  label?: string
  className?: string
}

/** The one back affordance: a 44px icon button that sits before a page title. */
export function BackButton({ onClick, label = 'Back', className }: BackButtonProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-label={label}
      className={cn(
        '-ml-2 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <DuotoneIcon icon={ArrowLeft} size={22} active />
    </button>
  )
}
