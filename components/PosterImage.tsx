'use client'

import Image from 'next/image'
import { useState } from 'react'

interface PosterImageProps {
  src?: string | null
  alt: string
  width: number
  height: number
  className?: string
}

export function PosterImage({ src, alt, width, height, className }: PosterImageProps) {
  const [error, setError] = useState(false)

  if (!src || error) {
    return (
      <div
        className={`bg-muted flex items-center justify-center ${className || ''}`}
        // Capped so a detail-sized placeholder still fits a narrow card.
        style={{ width, height, maxWidth: '100%', maxHeight: '100%' }}
      >
        <span className='text-muted-foreground text-xs'>No image</span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => setError(true)}
      unoptimized
    />
  )
}
