'use client'

import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, cardClassName } from '@/components/ui/card'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import { cn } from '@/lib/utils'

// Same surface as MediaCard so Settings reads like Browse/Watch.
export const settingsCardClassName = cardClassName

interface SettingsCardProps {
  children: ReactNode
  className?: string
}

export function SettingsCard({ children, className }: SettingsCardProps) {
  return (
    <Card as='section' className={className}>
      {children}
    </Card>
  )
}

interface SettingsCardHeaderProps {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function SettingsCardHeader({
  icon,
  title,
  description,
  action,
  className,
}: SettingsCardHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className='min-w-0'>
        <div className='flex items-center gap-2'>
          {icon && <DuotoneIcon icon={icon} size={18} />}
          <h2 className='text-lg font-semibold leading-tight text-foreground'>{title}</h2>
        </div>
        {description && <p className='mt-1 text-sm text-muted-foreground'>{description}</p>}
      </div>
      {action && <div className='flex-shrink-0'>{action}</div>}
    </div>
  )
}

export function SettingsBadge({
  children,
  variant = 'primary',
  className,
}: {
  children: ReactNode
  variant?: 'primary' | 'muted'
  className?: string
}) {
  return (
    <Badge variant={variant} className={className}>
      {children}
    </Badge>
  )
}
