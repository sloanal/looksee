'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'

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
  const [status, setStatus] = useState('not_seen_want')
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
        setStatus('not_seen_want')
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return null
  }

  const currentItem = items[currentIndex]
  const progress = ((currentIndex + 1) / items.length) * 100

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">
              {currentIndex + 1} of {items.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-sm text-blue-600 hover:underline"
            >
              Skip for now
            </button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center mb-6">
            {currentItem.posterUrl && (
              <div className="mb-4 flex justify-center">
                <Image
                  src={currentItem.posterUrl}
                  alt={currentItem.title}
                  width={200}
                  height={300}
                  className="rounded"
                />
              </div>
            )}
            <h2 className="text-2xl font-bold mb-2 text-gray-900">{currentItem.title}</h2>
            <p className="text-sm text-gray-600 capitalize mb-1">{currentItem.type}</p>
            {currentItem.genres.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1 mb-2">
                {currentItem.genres.slice(0, 3).map((genre, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
            {currentItem.description && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-3">{currentItem.description}</p>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3">Status</label>
              <div className="space-y-2">
                {[
                  { value: 'not_seen_want', label: "Haven&apos;t seen, want to watch" },
                  { value: 'not_seen_dont_want', label: "Haven&apos;t seen, don&apos;t want to watch" },
                  { value: 'seen_would_rewatch', label: 'Seen, would rewatch' },
                  { value: 'seen_wont_rewatch', label: 'Seen, would not rewatch' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors"
                    style={{
                      borderColor: status === opt.value ? '#2563eb' : '#e5e7eb',
                      backgroundColor: status === opt.value ? '#eff6ff' : 'white',
                    }}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={opt.value}
                      checked={status === opt.value}
                      onChange={(e) => setStatus(e.target.value)}
                      className="mr-3"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Excitement: {excitement}/5
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={excitement}
                onChange={(e) => setExcitement(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1</span>
                <span>5</span>
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={saving}
              className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving
                ? 'Saving...'
                : currentIndex + 1 >= items.length
                  ? 'Finish'
                  : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

