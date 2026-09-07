'use client'

import { ReactNode } from 'react'
import { Calendar, Clock, LucideIcon, Plus, Sofa } from 'lucide-react'
import { PosterImage } from './PosterImage'
import { Badge } from '@/components/ui/badge'
import { Card, CardBand } from '@/components/ui/card'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import { cn } from '@/lib/utils'

export { CardBand }

interface MediaCardProps {
  children: ReactNode
  onClick?: () => void
  className?: string
  variant?: 'default' | 'highlighted' | 'clickable'
}

/** Media card: the shared `Card` surface with media-specific children below. */
export function MediaCard({ children, onClick, className, variant = 'default' }: MediaCardProps) {
  return (
    <Card
      onClick={onClick}
      variant={variant === 'clickable' ? 'interactive' : variant}
      className={className}
    >
      {children}
    </Card>
  )
}

interface CardPosterProps {
  src?: string | null
  alt: string
  width?: number
  height?: number
  className?: string
}

export function CardPoster({ src, alt, width = 80, height = 120, className }: CardPosterProps) {
  if (!src) return null

  return (
    <div className={cn('flex-shrink-0', className)}>
      <PosterImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        className='rounded-lg object-cover shadow-sm'
      />
    </div>
  )
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mb-3', className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn('mb-0.5 text-lg font-semibold leading-snug text-foreground', className)}>
      {children}
    </h3>
  )
}

export function CardSubtitle({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-xs capitalize text-muted-foreground', className)}>{children}</p>
}

interface CardMetaProps {
  icon: LucideIcon
  type: string
  releaseDate?: string | null
  runtimeMinutes?: number | null
  className?: string
}

/**
 * "2h 28m" for movies; TMDB gives shows a per-episode runtime, so "45m/ep".
 */
export function formatRuntime(minutes: number, type: string): string {
  const perEpisode = type.toLowerCase() === 'show'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const base = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
  return perEpisode ? `${base}/ep` : base
}

/** "▣ Movie · 📅 2010 · ◷ 2h 28m" line under a title. */
export function CardMeta({ icon, type, releaseDate, runtimeMinutes, className }: CardMetaProps) {
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null
  const showRuntime = typeof runtimeMinutes === 'number' && runtimeMinutes > 0
  return (
    <div
      className={cn(
        'mb-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground',
        className,
      )}
    >
      <span className='inline-flex items-center gap-1 capitalize'>
        <DuotoneIcon icon={icon} size={12} />
        {type}
      </span>
      {year !== null && !isNaN(year) && (
        <span className='inline-flex items-center gap-1'>
          <DuotoneIcon icon={Calendar} size={12} />
          {year}
        </span>
      )}
      {showRuntime && (
        <span className='inline-flex items-center gap-1'>
          <DuotoneIcon icon={Clock} size={12} />
          {formatRuntime(runtimeMinutes, type)}
        </span>
      )}
    </div>
  )
}

interface CardDescriptionProps {
  children: ReactNode
  className?: string
  lineClamp?: number
}

export function CardDescription({ children, className, lineClamp = 2 }: CardDescriptionProps) {
  const clampClasses: Record<number, string> = {
    1: 'line-clamp-1',
    2: 'line-clamp-2',
    3: 'line-clamp-3',
    4: 'line-clamp-4',
    5: 'line-clamp-5',
  }
  const clampClass = lineClamp > 0 && lineClamp <= 5 ? clampClasses[lineClamp] : ''
  return (
    <p className={cn('mb-2 text-sm leading-relaxed text-muted-foreground', clampClass, className)}>
      {children}
    </p>
  )
}

interface CardGenresProps {
  genres: string[]
  maxDisplay?: number
  className?: string
}

export function CardGenres({ genres, maxDisplay = 3, className }: CardGenresProps) {
  if (!genres || genres.length === 0) return null

  return (
    <div className={cn('mb-1.5 flex flex-wrap gap-1', className)}>
      {genres.slice(0, maxDisplay).map((genre, i) => (
        <Badge key={i} size='sm'>
          {genre}
        </Badge>
      ))}
    </div>
  )
}

interface CardBadgeProps {
  children: ReactNode
  variant?: 'primary' | 'secondary'
  className?: string
}

export function CardBadge({ children, variant = 'primary', className }: CardBadgeProps) {
  return (
    <Badge variant={variant === 'primary' ? 'solid' : 'default'} size='lg' className={className}>
      {children}
    </Badge>
  )
}

export function CardActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-4', className)}>{children}</div>
}

interface CardRoomsBandProps {
  rooms: Array<{ id: string; name: string }>
  /** Makes the band a button (Browse opens Edit Rooms). */
  onClick?: () => void
  emptyLabel?: string
  className?: string
}

/** Room chips strip across the top of a media card. */
export function CardRoomsBand({ rooms, onClick, emptyLabel, className }: CardRoomsBandProps) {
  const content = (
    <>
      <DuotoneIcon icon={Sofa} size={14} className='flex-shrink-0' />
      {rooms.length > 0
        ? rooms.map((room) => (
          <Badge key={room.id} variant='outline' size='sm'>
            {room.name}
          </Badge>
        ))
        : emptyLabel && <span className='text-xs text-muted-foreground'>{emptyLabel}</span>}
    </>
  )

  if (onClick) {
    return (
      <CardBand
        position='top'
        className={cn(
          'group relative flex min-h-[40px] cursor-pointer items-center gap-2 transition-colors hover:bg-muted',
          className,
        )}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        role='button'
        aria-label='Edit rooms'
      >
        <div className='flex flex-1 flex-wrap items-center gap-1.5 pr-8'>{content}</div>
        <span className='absolute right-4 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-muted-foreground/60 text-muted-foreground transition-colors group-hover:border-foreground group-hover:text-foreground'>
          <Plus size={10} strokeWidth={3} />
        </span>
      </CardBand>
    )
  }

  return (
    <CardBand position='top' className={cn('flex min-h-[40px] items-center gap-2', className)}>
      <div className='flex flex-1 flex-wrap items-center gap-1.5'>{content}</div>
    </CardBand>
  )
}

export function CardMenu({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('absolute right-1 top-1 z-[1]', className)} data-menu-container>
      {children}
    </div>
  )
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('min-w-0 flex-1', className)}>{children}</div>
}

/** Horizontal poster + content layout. */
export function CardLayout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex gap-4', className)}>{children}</div>
}
