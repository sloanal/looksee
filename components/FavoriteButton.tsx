'use client'

import { MouseEvent, useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface FavoriteButtonProps {
  mediaItemId: string
  isFavorite: boolean
  /** Called with the server-confirmed value after a successful toggle. */
  onChange?: (isFavorite: boolean) => void
  size?: number
  className?: string
}

export function FavoriteButton({
  mediaItemId,
  isFavorite,
  onChange,
  size = 20,
  className,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(isFavorite)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setFavorited(isFavorite)
  }, [isFavorite])

  const toggle = async (e: MouseEvent<HTMLButtonElement>) => {
    // Cards open their detail modal on click; the heart must never bubble to them.
    e.preventDefault()
    e.stopPropagation()
    if (pending) return

    const next = !favorited
    setFavorited(next)
    setPending(true)
    try {
      const res = await fetch(`/api/media/${mediaItemId}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: next }),
      })
      if (!res.ok) {
        throw new Error(`Favorite toggle failed with ${res.status}`)
      }
      const data = await res.json()
      const confirmed = data.isFavorite === true
      setFavorited(confirmed)
      onChange?.(confirmed)
    } catch (err) {
      console.error('Failed to update favorite:', err)
      setFavorited(!next)
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type='button'
      onClick={toggle}
      aria-pressed={favorited}
      aria-busy={pending}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
      title={favorited ? 'Remove from favorites' : 'Add to favorites'}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        favorited ? 'text-favorite' : 'text-muted-foreground hover:text-favorite',
        className,
      )}
    >
      <Heart
        size={size}
        strokeWidth={favorited ? 2 : 1.75}
        className={cn('transition-transform', favorited && 'fill-current scale-110')}
      />
    </button>
  )
}

export function favoritedByLabel(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return `${names[0]} favorited this`
  if (names.length === 2) return `${names[0]} and ${names[1]} favorited this`
  return `${names.length} people favorited this`
}

interface FavoritedByBadgeProps {
  names: string[]
  className?: string
}

/** Tiny filled heart + count for other visible members who favorited a title. */
export function FavoritedByBadge({ names, className }: FavoritedByBadgeProps) {
  if (names.length === 0) return null
  const label = names.length > 2
    ? `${favoritedByLabel(names)}: ${names.join(', ')}`
    : favoritedByLabel(names)

  return (
    <Badge variant='favorite' size='sm' title={label} aria-label={label} className={className}>
      <Heart size={12} className='fill-current' />
      {names.length}
    </Badge>
  )
}
