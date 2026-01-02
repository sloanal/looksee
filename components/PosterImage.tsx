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
        className={`bg-gray-200 flex items-center justify-center ${className || ''}`}
        style={{ width, height }}
      >
        <span className="text-gray-400 text-xs">No image</span>
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

