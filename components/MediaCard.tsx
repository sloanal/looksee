'use client'

import { ReactNode } from 'react'
import { PosterImage } from './PosterImage'

interface MediaCardProps {
  children: ReactNode
  onClick?: () => void
  className?: string
  variant?: 'default' | 'highlighted' | 'clickable'
}

interface CardPosterProps {
  src?: string | null
  alt: string
  width?: number
  height?: number
  className?: string
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

interface CardTitleProps {
  children: ReactNode
  className?: string
}

interface CardSubtitleProps {
  children: ReactNode
  className?: string
}

interface CardDescriptionProps {
  children: ReactNode
  className?: string
  lineClamp?: number
}

interface CardGenresProps {
  genres: string[]
  maxDisplay?: number
  className?: string
}

interface CardBadgeProps {
  children: ReactNode
  variant?: 'primary' | 'secondary'
  className?: string
}

interface CardActionsProps {
  children: ReactNode
  className?: string
}

interface CardMenuProps {
  children: ReactNode
  className?: string
}

interface CardContentProps {
  children: ReactNode
  className?: string
}

// Main Card Component
export function MediaCard({ children, onClick, className = '', variant = 'default' }: MediaCardProps) {
  const baseClasses = 'bg-card rounded-lg border border-border p-4 transition-shadow shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06),inset_0_-1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06),inset_0_-1px_3px_rgba(0,0,0,0.2)]'
  const variantClasses = {
    default: '',
    highlighted: 'border-2 border-primary shadow-lg',
    clickable: 'cursor-pointer hover:shadow-lg',
  }

  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${className}`.trim()

  if (onClick) {
    return (
      <div onClick={onClick} className={combinedClasses}>
        {children}
      </div>
    )
  }

  return <div className={combinedClasses}>{children}</div>
}

// Card Subcomponents
export function CardPoster({ src, alt, width = 80, height = 120, className = '' }: CardPosterProps) {
  if (!src) return null

  return (
    <div className={`flex-shrink-0 ${className}`}>
      <PosterImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="rounded object-cover"
      />
    </div>
  )
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return <div className={`mb-3 ${className}`}>{children}</div>
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3 className={`font-semibold text-lg mb-0.5 text-foreground ${className}`}>{children}</h3>
  )
}

export function CardSubtitle({ children, className = '' }: CardSubtitleProps) {
  return <p className={`text-xs text-muted-foreground capitalize ${className}`}>{children}</p>
}

export function CardDescription({ children, className = '', lineClamp = 2 }: CardDescriptionProps) {
  const clampClasses: Record<number, string> = {
    1: 'line-clamp-1',
    2: 'line-clamp-2',
    3: 'line-clamp-3',
    4: 'line-clamp-4',
    5: 'line-clamp-5',
  }
  const clampClass = lineClamp > 0 && lineClamp <= 5 ? clampClasses[lineClamp] || 'line-clamp-2' : ''
  return (
    <p className={`text-sm text-muted-foreground mb-2 ${clampClass} ${className}`}>{children}</p>
  )
}

export function CardGenres({ genres, maxDisplay = 3, className = '' }: CardGenresProps) {
  if (!genres || genres.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1 mb-1 ${className}`}>
      {genres.slice(0, maxDisplay).map((genre, i) => (
        <span
          key={i}
          className="px-2 py-1 bg-secondary text-muted-foreground text-xs rounded"
        >
          {genre}
        </span>
      ))}
    </div>
  )
}

export function CardBadge({ children, variant = 'primary', className = '' }: CardBadgeProps) {
  const variantClasses = {
    primary: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
  }

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  )
}

export function CardActions({ children, className = '' }: CardActionsProps) {
  return <div className={`mt-4 ${className}`}>{children}</div>
}

export function CardMenu({ children, className = '' }: CardMenuProps) {
  return (
    <div className={`absolute top-2 right-2 z-0 ${className}`} data-menu-container>
      {children}
    </div>
  )
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={`flex-1 min-w-0 ${className}`}>{children}</div>
}

// Layout wrapper for horizontal card layout
export function CardLayout({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex gap-4 ${className}`}>{children}</div>
}
