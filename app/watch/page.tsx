'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'

interface Recommendation {
  id: string
  title: string
  type: string
  posterUrl?: string
  genres: string[]
  myExcitement?: number
  myStatus?: string
  interestedCount: number
  avgExcitement: number
  interestedUsers: Array<{ id: string; name: string }>
}

export default function WatchPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')

  const [step, setStep] = useState<'who' | 'preferences' | 'results'>('who')
  const [mode, setMode] = useState<'me' | 'room'>('me')
  const [typePreference, setTypePreference] = useState('any')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Recommendation | null>(null)
  const [showWarning, setShowWarning] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    if (!roomId) {
      fetch('/api/rooms')
        .then((res) => res.json())
        .then((data) => {
          if (data.rooms && data.rooms.length > 0) {
            router.push(`/watch?roomId=${data.rooms[0].id}`)
          } else {
            router.push('/rooms/setup')
          }
        })
    }
  }, [session, status, roomId, router])

  const handleGetRecommendations = async () => {
    if (!roomId) return

    setLoading(true)
    try {
      const res = await fetch(`/api/rooms/${roomId}/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          typePreference,
          genres: selectedGenres,
        }),
      })

      const data = await res.json()
      if (data.recommendations) {
        setRecommendations(data.recommendations)
        setStep('results')
      }
    } catch (err) {
      console.error('Failed to get recommendations:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectItem = (item: Recommendation) => {
    // Check if we need to show warning
    if (mode === 'me' && item.interestedCount > 1) {
      // Check if there are other users interested
      const otherInterested = item.interestedUsers.filter((u) => u.id !== session?.user?.id)
      if (otherInterested.length > 0) {
        setSelectedItem(item)
        setShowWarning(true)
        return
      }
    }
    // No warning needed, just proceed
    handleProceed()
  }

  const handleProceed = () => {
    // In a real app, this would start playback or mark as started
    alert('Enjoy watching! (In a real app, this would start playback)')
    setShowWarning(false)
    setSelectedItem(null)
  }

  if (!roomId) {
    return <div className="p-4">Loading...</div>
  }

  if (step === 'who') {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Who's watching?</h1>

        <div className="space-y-4">
          <button
            onClick={() => {
              setMode('me')
              setStep('preferences')
            }}
            className="w-full bg-blue-600 text-white py-6 rounded-lg font-medium hover:bg-blue-700 transition-colors text-lg"
          >
            Just me
          </button>
          <button
            onClick={() => {
              setMode('room')
              setStep('preferences')
            }}
            className="w-full bg-white border-2 border-gray-300 text-gray-700 py-6 rounded-lg font-medium hover:bg-gray-50 transition-colors text-lg"
          >
            Everyone in the room
          </button>
        </div>
      </div>
    )
  }

  if (step === 'preferences') {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-4">
          <button onClick={() => setStep('who')} className="text-blue-600">
            ← Back
          </button>
        </div>

        <h1 className="text-2xl font-bold mb-6">Preferences (all optional)</h1>

        <div className="space-y-6 mb-8">
          <div>
            <label className="block text-sm font-medium mb-2">Content Type</label>
            <select
              value={typePreference}
              onChange={(e) => setTypePreference(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value="any">No preference</option>
              <option value="movie">Movie</option>
              <option value="show">Show</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Genres (optional)</label>
            <p className="text-sm text-gray-600 mb-2">
              Genre filtering coming soon - for now showing all types
            </p>
          </div>
        </div>

        <button
          onClick={handleGetRecommendations}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-lg"
        >
          {loading ? 'Finding recommendations...' : 'Show me something'}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-4">
        <button onClick={() => setStep('preferences')} className="text-blue-600">
          ← Back
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-6">Recommendations</h1>

      {recommendations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No recommendations found. Try adjusting your preferences.</p>
          <button
            onClick={() => setStep('preferences')}
            className="mt-4 text-blue-600 hover:underline"
          >
            Go back
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {recommendations.map((rec, index) => (
            <div
              key={rec.id}
              className={`bg-white rounded-lg shadow-md border-2 p-6 ${
                index === 0 ? 'border-blue-500' : 'border-gray-200'
              }`}
            >
              {index === 0 && (
                <div className="mb-3">
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Top Pick
                  </span>
                </div>
              )}

              <div className="flex gap-4">
                {rec.posterUrl && (
                  <div className="flex-shrink-0">
                    <Image
                      src={rec.posterUrl}
                      alt={rec.title}
                      width={120}
                      height={180}
                      className="rounded object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">{rec.title}</h3>
                  <p className="text-sm text-gray-600 mb-2 capitalize">{rec.type}</p>
                  {rec.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {rec.genres.slice(0, 3).map((genre, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}

                  {mode === 'room' ? (
                    <div className="text-sm text-gray-600 mb-3">
                      <p>
                        {rec.interestedCount} {rec.interestedCount === 1 ? 'person' : 'people'} want
                        to watch this
                      </p>
                      <p>Average excitement: {rec.avgExcitement}/5</p>
                      {rec.interestedUsers.length > 0 && (
                        <p className="mt-1">
                          {rec.interestedUsers.map((u) => u.name).join(', ')}
                        </p>
                      )}
                    </div>
                  ) : (
                    rec.myExcitement && (
                      <div className="text-sm text-gray-600 mb-3">
                        <p>My excitement: {'⭐'.repeat(rec.myExcitement)}</p>
                      </div>
                    )
                  )}

                  <button
                    onClick={() => handleSelectItem(rec)}
                    className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700"
                  >
                    Watch this
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showWarning && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Heads up!</h2>
            <p className="mb-4 text-gray-700">
              {selectedItem.interestedUsers
                .filter((u) => u.id !== session?.user?.id)
                .map((u) => u.name)
                .join(' and ')}{' '}
              also really want to watch this. Are you sure you want to go ahead without them?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWarning(false)
                  setSelectedItem(null)
                }}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-md font-medium hover:bg-gray-200"
              >
                Never mind, pick something else
              </button>
              <button
                onClick={handleProceed}
                className="flex-1 bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700"
              >
                Proceed anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

