'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Film, Tv, Video, Link as LinkIcon, Calendar, Star } from 'lucide-react'
import { RoomSelector } from '@/components/RoomSelector'
import { RoomMembersAvatars } from '@/components/RoomMembersAvatars'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import { useModalAnimation } from '@/lib/useModalAnimation'
import {
  MediaCard,
  CardLayout,
  CardPoster,
  CardContent,
  CardTitle,
  CardSubtitle,
  CardGenres,
  CardBadge,
  CardActions,
  CardHeader,
} from '@/components/MediaCard'

function getTypeIcon(type: string) {
  const normalizedType = type.toLowerCase()
  if (normalizedType === 'movie' || normalizedType === 'movies') {
    return Film
  } else if (normalizedType === 'show' || normalizedType === 'tv' || normalizedType === 'shows') {
    return Tv
  } else if (normalizedType === 'video' || normalizedType === 'videos') {
    return Video
  } else if (normalizedType === 'link' || normalizedType === 'links') {
    return LinkIcon
  }
  return Film // default
}

interface Recommendation {
  id: string
  title: string
  type: string
  posterUrl?: string
  genres: string[]
  releaseDate?: string
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
  const { isClosing: isWarningClosing, handleClose: handleWarningClose } = useModalAnimation(() => {
    setShowWarning(false)
    setSelectedItem(null)
  })

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    // Check if user has rooms (needed for recommendations)
    if (roomId === null || roomId === 'all-rooms') {
      fetch('/api/rooms')
        .then((res) => res.json())
        .then((data) => {
          if (!data.rooms || data.rooms.length === 0) {
            router.push('/rooms/setup')
          }
          // Otherwise, allow null roomId or "all-rooms" to persist
        })
    }
  }, [session, status, roomId, router])

  const handleGetRecommendations = async () => {
    setLoading(true)
    try {
      // Use the new flexible recommendations endpoint
      const url = new URL('/api/recommendations', window.location.origin)
      if (roomId) {
        url.searchParams.set('roomId', roomId)
      }
      // If roomId is null, don't add it to the URL (for "Just My Stuff")

      const res = await fetch(url.toString(), {
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

  // Show loading while checking rooms if needed
  // Allow null roomId (Just My Stuff) and "all-rooms" to proceed

  if (step === 'who') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="sticky top-0 bg-background border-b border-border z-10 p-4">
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-2xl font-bold text-foreground">Watch from</h1>
            <RoomSelector />
          </div>
        </div>
        <div className="p-4">
          <h2 className="text-2xl font-bold mb-6 text-foreground">Who&apos;s watching?</h2>

          <div className="space-y-4">
            <button
              onClick={() => {
                setMode('me')
                setStep('preferences')
              }}
              className="w-full bg-primary text-primary-foreground py-6 rounded-lg font-medium hover:bg-primary/90 transition-colors text-lg"
            >
              Just me
            </button>
            <button
              onClick={() => {
                setMode('room')
                setStep('preferences')
              }}
              className="w-full bg-card border-2 border-border text-foreground py-6 rounded-lg font-medium hover:bg-accent transition-colors text-lg"
            >
              Everyone in the room
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'preferences') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="sticky top-0 bg-background border-b border-border z-10 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setStep('who')} className="text-primary">
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-foreground">Watch from</h1>
            </div>
            <RoomSelector />
          </div>
        </div>
        <div className="p-4">
          <h2 className="text-2xl font-bold mb-6 text-foreground">Preferences (all optional)</h2>

          <div className="space-y-6 mb-8">
            <div>
              <label className="block text-sm font-medium mb-2">Content Type</label>
              <select
                value={typePreference}
                onChange={(e) => setTypePreference(e.target.value)}
                className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground"
              >
                <option value="any">No preference</option>
                <option value="movie">Movie</option>
                <option value="show">Show</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Genres (optional)</label>
              <p className="text-sm text-muted-foreground mb-2">
                Genre filtering coming soon - for now showing all types
              </p>
            </div>
          </div>

          <button
            onClick={handleGetRecommendations}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-4 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 text-lg"
          >
            {loading ? 'Finding recommendations...' : 'Show me something'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="sticky top-0 bg-background border-b border-border z-10 p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setStep('preferences')} className="text-primary">
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-foreground">Watch from</h1>
            <RoomSelector />
          </div>
          <RoomMembersAvatars />
        </div>
      </div>

      <div className="p-4">
        <h2 className="text-2xl font-bold mb-6 text-foreground">Recommendations</h2>
      </div>

      {recommendations.length === 0 ? (
        <div className="p-4 text-center py-12 text-muted-foreground">
          <p>No recommendations found. Try adjusting your preferences.</p>
          <button
            onClick={() => setStep('preferences')}
            className="mt-4 text-primary hover:underline"
          >
            Go back
          </button>
        </div>
      ) : (
        <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
          <div className="space-y-4 bg-content p-4">
            {recommendations.map((rec, index) => (
            <MediaCard
              key={rec.id}
              variant={index === 0 ? 'highlighted' : 'default'}
              className="p-6"
            >
              {index === 0 && (
                <CardHeader>
                  <CardBadge>Top Pick</CardBadge>
                </CardHeader>
              )}

              <CardLayout>
                <CardPoster src={rec.posterUrl} alt={rec.title} width={80} height={120} />
                <CardContent>
                  <CardTitle className="text-xl">{rec.title}</CardTitle>
                  <div className="flex items-center gap-1 mb-0.5">
                    <DuotoneIcon icon={getTypeIcon(rec.type)} size={12} />
                    <CardSubtitle className="mb-0">{rec.type}</CardSubtitle>
                    {rec.releaseDate && (
                      <>
                        <DuotoneIcon icon={Calendar} size={12} />
                        <p className="text-xs text-muted-foreground mb-0">
                          {new Date(rec.releaseDate).getFullYear()}
                        </p>
                      </>
                    )}
                  </div>
                  <CardGenres genres={rec.genres} maxDisplay={3} />
                </CardContent>
              </CardLayout>

              {mode === 'room' ? (
                <div className="text-sm text-muted-foreground -mx-4 px-4 pt-2 border-t border-border mt-2">
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
                  <div className="text-sm text-muted-foreground -mx-4 px-4 pt-2 border-t border-border mt-2">
                    <p className="flex items-center gap-1">
                      My excitement:{' '}
                      {Array.from({ length: rec.myExcitement }).map((_, i) => (
                        <DuotoneIcon key={i} icon={Star} size={14} />
                      ))}
                    </p>
                  </div>
                )
              )}

              <CardActions>
                <button
                  onClick={() => handleSelectItem(rec)}
                  className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-medium hover:bg-primary/90"
                >
                  Watch this
                </button>
              </CardActions>
            </MediaCard>
            ))}
          </div>
        </div>
      )}

      {showWarning && selectedItem && (
        <div className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-overlay ${isWarningClosing ? 'closing' : ''}`} onClick={handleWarningClose}>
          <div className={`bg-card rounded-lg max-w-md w-full p-6 border border-border modal-content ${isWarningClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4 text-foreground">Heads up!</h2>
            <p className="mb-4 text-muted-foreground">
              {selectedItem.interestedUsers
                .filter((u) => u.id !== session?.user?.id)
                .map((u) => u.name)
                .join(' and ')}{' '}
              also really want to watch this. Are you sure you want to go ahead without them?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleWarningClose}
                className="flex-1 bg-secondary text-secondary-foreground py-3 rounded-md font-medium hover:bg-secondary/80"
              >
                Never mind, pick something else
              </button>
              <button
                onClick={() => {
                  handleWarningClose()
                  handleProceed()
                }}
                className="flex-1 bg-primary text-primary-foreground py-3 rounded-md font-medium hover:bg-primary/90"
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

