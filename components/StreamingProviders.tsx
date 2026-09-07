'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface Provider {
  id: number
  name: string
  logoUrl: string
}

interface WatchProviders {
  region: string
  link: string | null
  flatrate: Provider[]
  rent: Provider[]
  buy: Provider[]
}

interface StreamingProvidersProps {
  tmdbId: string | number
  type: string
  compact?: boolean
  className?: string
}

const COMPACT_MAX = 3

// Module-level so reopening the same title (or the same title appearing on
// several cards) never refetches within a page session.
const clientCache = new Map<string, WatchProviders>()
const inflight = new Map<string, Promise<WatchProviders | null>>()

const normalizeType = (type: string) => (type.toLowerCase() === 'movie' ? 'movie' : 'show')

const isEmpty = (data: WatchProviders) =>
  data.flatrate.length === 0 && data.rent.length === 0 && data.buy.length === 0

async function loadProviders(tmdbId: string, type: 'movie' | 'show') {
  const key = `${type}:${tmdbId}`
  const cached = clientCache.get(key)
  if (cached) return cached

  let pending = inflight.get(key)
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(`/api/tmdb/providers?tmdbId=${tmdbId}&type=${type}`)
        if (!res.ok) return null
        const data = (await res.json()) as WatchProviders
        if (!data || !Array.isArray(data.flatrate)) return null
        clientCache.set(key, data)
        return data
      } catch (err) {
        console.error('Failed to load streaming providers:', err)
        return null
      } finally {
        inflight.delete(key)
      }
    })()
    inflight.set(key, pending)
  }
  return pending
}

function dedupeProviders(...lists: Provider[][]) {
  const seen = new Set<number>()
  const result: Provider[] = []
  for (const list of lists) {
    for (const provider of list) {
      if (seen.has(provider.id)) continue
      seen.add(provider.id)
      result.push(provider)
    }
  }
  return result
}

function ProviderLogo({ provider, size }: { provider: Provider; size: number }) {
  const [failed, setFailed] = useState(false)

  if (!provider.logoUrl || failed) {
    return (
      <span
        title={provider.name}
        className='inline-flex items-center rounded bg-secondary px-1.5 text-[10px] font-medium leading-none text-secondary-foreground'
        style={{ height: size }}
      >
        {provider.name}
      </span>
    )
  }

  return (
    <Image
      src={provider.logoUrl}
      alt={provider.name}
      title={provider.name}
      width={size}
      height={size}
      className='rounded-md object-cover flex-shrink-0 border border-border/60'
      style={{ width: size, height: size }}
      unoptimized
      onError={() => setFailed(true)}
    />
  )
}

function ProviderRow({ label, providers }: { label: string; providers: Provider[] }) {
  return (
    <div className='flex flex-wrap items-center gap-2'>
      <span className='w-20 shrink-0 text-xs text-muted-foreground'>{label}</span>
      <div className='flex flex-wrap items-center gap-1.5'>
        {providers.map((provider) => (
          <ProviderLogo key={provider.id} provider={provider} size={32} />
        ))}
      </div>
    </div>
  )
}

export function StreamingProviders(
  { tmdbId, type, compact = false, className = '' }: StreamingProvidersProps,
) {
  const [data, setData] = useState<WatchProviders | null>(null)
  const id = String(tmdbId)
  const mediaType = normalizeType(type)

  useEffect(() => {
    let cancelled = false
    setData(null)
    loadProviders(id, mediaType).then((result) => {
      if (!cancelled) setData(result)
    })
    return () => {
      cancelled = true
    }
  }, [id, mediaType])

  if (!data || isEmpty(data)) return null

  if (compact) {
    if (data.flatrate.length === 0) return null
    const visible = data.flatrate.slice(0, COMPACT_MAX)
    const overflow = data.flatrate.length - visible.length
    return (
      <div
        className={`flex items-center gap-1 ${className}`}
        aria-label={`Stream on ${data.flatrate.map((p) => p.name).join(', ')}`}
      >
        {visible.map((provider) => (
          <ProviderLogo key={provider.id} provider={provider} size={20} />
        ))}
        {overflow > 0 && (
          <span
            className='inline-flex h-5 items-center rounded bg-secondary px-1.5 text-[10px] font-medium text-muted-foreground'
            title={data.flatrate.slice(COMPACT_MAX).map((p) =>
              p.name
            ).join(', ')}
          >
            +{overflow}
          </span>
        )}
      </div>
    )
  }

  const rentBuy = dedupeProviders(data.rent, data.buy)

  return (
    <div className={className}>
      <h3 className='text-lg font-semibold mb-2 text-foreground'>Where to watch</h3>
      <div className='space-y-2'>
        {data.flatrate.length > 0 && <ProviderRow label='Stream on' providers={data.flatrate} />}
        {rentBuy.length > 0 && <ProviderRow label='Rent / Buy' providers={rentBuy} />}
        {data.link
          ? (
            <a
              href={data.link}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-block text-[11px] text-muted-foreground hover:text-foreground hover:underline'
            >
              Powered by JustWatch
            </a>
          )
          : (
            <span className='inline-block text-[11px] text-muted-foreground'>
              Powered by JustWatch
            </span>
          )}
      </div>
    </div>
  )
}
