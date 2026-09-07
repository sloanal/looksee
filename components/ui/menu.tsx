'use client'

import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react'
import { LucideIcon, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Presentational pieces for the small "⋮" menus on cards. Open/close state and
 * outside-click handling stay with the caller.
 */

interface MenuTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon
  label?: string
}

export const MenuTrigger = forwardRef<HTMLButtonElement, MenuTriggerProps>(
  ({ icon: Icon = MoreVertical, label = 'Menu', className, ...props }, ref) => (
    <button
      ref={ref}
      type='button'
      aria-label={label}
      aria-haspopup='menu'
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      <Icon size={18} />
    </button>
  ),
)
MenuTrigger.displayName = 'MenuTrigger'

interface MenuPanelProps {
  children: ReactNode
  className?: string
  align?: 'left' | 'right'
}

export function MenuPanel({ children, className, align = 'right' }: MenuPanelProps) {
  return (
    <div
      role='menu'
      className={cn(
        'absolute z-20 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-pop',
        align === 'right' ? 'right-0' : 'left-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface MenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon
  destructive?: boolean
}

export const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(
  ({ icon: Icon, destructive, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type='button'
      role='menuitem'
      className={cn(
        'flex h-11 w-full items-center gap-2.5 px-4 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
        destructive ? 'text-destructive' : 'text-foreground',
        className,
      )}
      {...props}
    >
      {Icon && <Icon className='h-4 w-4 flex-shrink-0' />}
      {children}
    </button>
  ),
)
MenuItem.displayName = 'MenuItem'
