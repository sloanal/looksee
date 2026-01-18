'use client'

import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DuotoneIconProps {
  icon: LucideIcon
  className?: string
  active?: boolean
  size?: number
  strokeWidth?: number
}

export function DuotoneIcon({ icon: Icon, className, active = false, size = 24, strokeWidth }: DuotoneIconProps) {
  const baseStrokeWidth = strokeWidth ?? 2
  const topStrokeWidth = strokeWidth ? strokeWidth * 1.25 : 2.5
  
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      {/* Base layer - lighter color */}
      <Icon
        className={cn(
          'absolute inset-0',
          active
            ? 'text-foreground opacity-40'
            : 'text-muted-foreground opacity-30'
        )}
        size={size}
        strokeWidth={baseStrokeWidth}
      />
      {/* Top layer - darker color */}
      <Icon
        className={cn(
          'relative',
          active
            ? 'text-foreground opacity-100'
            : 'text-muted-foreground opacity-60'
        )}
        size={size}
        strokeWidth={topStrokeWidth}
      />
    </div>
  )
}
