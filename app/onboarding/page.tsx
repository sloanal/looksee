'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RatingFields } from '@/components/RatingFields'

interface UnratedItem {
  id: string
  title: string
  type: string
  posterUrl?: string
  description?: string
  genres: string[]
  runtimeMinutes?: number
  createdBy: string
  createdAt: string
}

export default function OnboardingPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')

  const [items, setItems] = useState<UnratedItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [status, setStatus] = useState('have_not_seen')
  const [excitement, setExcitement] = useState(3)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadUnratedItems = useCallback(async () => {
    if (!roomId) return

    setLoading(true)
    try {
      const res = await fetch(`/api/rooms/${roomId}/unrated`)
      const data = await res.json()
      if (data.items) {
        setItems(data.items)
        if (data.items.length === 0) {
          // No unrated items, go to browse
          router.push(`/browse?roomId=${roomId}`)
        }
      }
    } catch (err) {
      console.error('Failed to load unrated items:', err)
    } finally {
      setLoading(false)
    }
  }, [roomId, router])

  useEffect(() => {
    if (sessionStatus === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    if (!roomId) {
      router.push('/rooms/setup')
      return
    }

    loadUnratedItems()
  }, [session, sessionStatus, roomId, router, loadUnratedItems])

  const handleNext = async () => {
    if (currentIndex >= items.length) return

    const currentItem = items[currentIndex]
    if (!currentItem) return

    setSaving(true)
    try {
      await fetch(`/api/media/${currentItem.id}/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          excitement: parseInt(excitement.toString()),
        }),
      })

      if (currentIndex + 1 >= items.length) {
        // Done with all items
        router.push(`/browse?roomId=${roomId}`)
      } else {
        setCurrentIndex(currentIndex + 1)
        setStatus('have_not_seen')
        setExcitement(3)
      }
    } catch (err) {
      console.error('Failed to save preference:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    router.push(`/browse?roomId=${roomId}`)
  }

  if (loading || !roomId) {
    return (
      <div className='flex min-h-[100dvh] items-center justify-center bg-canvas'>
        <p className='text-sm text-muted-foreground'>Loading...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return null
  }

  const currentItem = items[currentIndex]
  const progress = ((currentIndex + 1) / items.length) * 100

  return (
    <div className='flex min-h-[100dvh] flex-col bg-canvas safe-bottom'>
      <div className='border-b border-border bg-background p-4'>
        <div className='mx-auto max-w-2xl'>
          <div className='mb-2 flex items-center justify-between'>
            <span className='text-sm text-muted-foreground'>
              {currentIndex + 1} of {items.length}
            </span>
            <button
              onClick={handleSkip}
              className='text-sm font-medium text-foreground underline-offset-4 hover:underline'
            >
              Skip for now
            </button>
          </div>
          <div className='h-2 w-full rounded-full bg-secondary'>
            <div
              className='h-2 rounded-full bg-primary transition-all'
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className='flex flex-1 items-center justify-center p-4'>
        <Card className='w-full max-w-md p-6 shadow-pop'>
          <div className='mb-6 text-center'>
            {currentItem.posterUrl && (
              <div className='mb-4 flex justify-center'>
                <Image
                  src={currentItem.posterUrl}
                  alt={currentItem.title}
                  width={200}
                  height={300}
                  className='rounded-xl shadow-card'
                />
              </div>
            )}
            <h2 className='mb-1 text-2xl font-bold text-foreground'>{currentItem.title}</h2>
            <p className='mb-2 text-sm capitalize text-muted-foreground'>{currentItem.type}</p>
            {currentItem.genres.length > 0 && (
              <div className='mb-2 flex flex-wrap justify-center gap-1.5'>
                {currentItem.genres.slice(0, 3).map((genre, i) => <Badge key={i}>{genre}</Badge>)}
              </div>
            )}
            {currentItem.description && (
              <p className='mt-2 line-clamp-3 text-sm text-muted-foreground'>
                {currentItem.description}
              </p>
            )}
          </div>

          <RatingFields
            status={status}
            excitement={excitement}
            onStatusChange={setStatus}
            onExcitementChange={setExcitement}
            className='mb-6'
          />

          <Button onClick={handleNext} disabled={saving} size='lg' className='w-full'>
            {saving ? 'Saving...' : currentIndex + 1 >= items.length ? 'Finish' : 'Next'}
          </Button>
        </Card>
      </div>
    </div>
  )
}
