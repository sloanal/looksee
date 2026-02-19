'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { CheckCircle2, Film, Tv, Video, Link as LinkIcon, Calendar, Star, ArrowLeft } from 'lucide-react'
import { RoomSelector } from '@/components/RoomSelector'
import { RoomMembersAvatars } from '@/components/RoomMembersAvatars'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import { useModalAnimation } from '@/lib/useModalAnimation'
import { getAvatarColor } from '@/lib/utils'
import { movieGenres, tvGenres } from '@/lib/tmdb-genres'
import {
  MediaCard,
  CardLayout,
  CardPoster,
  CardContent,
  CardTitle,
  CardSubtitle,
  CardDescription,
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
  description?: string
  genres: string[]
  releaseDate?: string
  rating?: number
  tmdbId?: string | null
  sourceType?: string
  myExcitement?: number
  myStatus?: string
  interestedCount: number
  avgExcitement: number
  interestedUsers: Array<{ id: string; name: string; imageUrl: string | null }>
  seenUsers: Array<{ id: string; name: string; imageUrl: string | null }>
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
  const [showSeenAndNoExcitement, setShowSeenAndNoExcitement] = useState(true)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Recommendation | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [detailModalItem, setDetailModalItem] = useState<Recommendation | null>(null)
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null)
  const [loadingTrailer, setLoadingTrailer] = useState(false)
  const [markingWatchedId, setMarkingWatchedId] = useState<string | null>(null)
  const prevTypePreferenceRef = useRef<string>(typePreference)
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

    // Allow users to access watch page even without rooms
    // Recommendations API will return empty array if no rooms, which is fine
  }, [session, status, router])

  // Filter selected genres when type preference changes to only include valid ones
  useEffect(() => {
    const prevType = prevTypePreferenceRef.current
    
    // Only filter if switching between specific types (not to/from 'any')
    if (typePreference === 'any' || prevType === 'any') {
      prevTypePreferenceRef.current = typePreference
      return
    }
    
    // Only filter if the type actually changed
    if (prevType !== typePreference) {
      // Filter selected genres to only include valid ones for the current type
      setSelectedGenres((currentGenres) => {
        if (currentGenres.length === 0) {
          return currentGenres
        }
        
        const validGenreIds = typePreference === 'movie' 
          ? Object.keys(movieGenres)
          : Object.keys(tvGenres)
        
        const filteredGenres = currentGenres.filter((genreId) => validGenreIds.includes(genreId))
        return filteredGenres
      })
    }
    
    prevTypePreferenceRef.current = typePreference
  }, [typePreference])

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
          showSeenAndNoExcitement: mode === 'me' ? showSeenAndNoExcitement : undefined,
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
    const searchQuery = `Where can I watch ${item.title}`
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`

    window.open(searchUrl, '_blank', 'noopener,noreferrer,popup=yes')
  }

  const handleProceed = () => {
    // In a real app, this would start playback or mark as started
    alert('Enjoy watching! (In a real app, this would start playback)')
    setShowWarning(false)
    setSelectedItem(null)
  }

  const handleMarkAsWatched = async (itemId: string) => {
    setMarkingWatchedId(itemId)
    try {
      const res = await fetch(`/api/media/${itemId}/watched`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to mark title as watched')
        return
      }
      setRecommendations((prev) => prev.filter((item) => item.id !== itemId))
    } catch (err) {
      console.error('Failed to mark as watched:', err)
      alert('Failed to mark title as watched')
    } finally {
      setMarkingWatchedId(null)
    }
  }

  async function loadTrailer(item: Recommendation) {
    if (!item.tmdbId || !item.sourceType || item.sourceType.toLowerCase() !== 'tmdb') {
      return
    }

    setLoadingTrailer(true)
    try {
      const type = item.type.toLowerCase() === 'movie' ? 'movie' : 'tv'
      const res = await fetch(`/api/tmdb/videos?id=${item.tmdbId}&type=${type}`)
      if (res.ok) {
        const data = await res.json()
        if (data.trailer?.url) {
          setTrailerUrl(data.trailer.url)
        }
      }
    } catch (err) {
      console.error('Failed to load trailer:', err)
    } finally {
      setLoadingTrailer(false)
    }
  }

  // Show loading while checking rooms if needed
  // Allow null roomId (Just My Stuff) and "all-rooms" to proceed

  if (step === 'who') {
    return (
      <div className="max-w-4xl xl:max-w-5xl mx-auto">
        <div className="sticky top-0 z-10">
          <div className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 bg-background border-b border-border pointer-events-none" />
          <div className="relative max-w-4xl xl:max-w-5xl mx-auto p-4">
            <div className="flex items-center gap-3 mb-4">
              <h1 className="text-2xl font-bold text-foreground">Watch from</h1>
              <RoomSelector />
            </div>
          </div>
        </div>
        <div className="p-4 bg-content min-h-[calc(100vh-200px)]">
          <p className="text-muted-foreground mb-4">We&apos;ll do our best to suggest something you&apos;ll like.</p>
          <h2 className="text-2xl font-bold mb-6 text-foreground">Who&apos;s watching?</h2>

          <div className="space-y-4">
            <button
              onClick={() => {
                setMode('room')
                setStep('preferences')
              }}
              className="w-full bg-primary text-primary-foreground py-6 rounded-lg font-medium hover:bg-primary/90 transition-colors text-lg"
            >
              Everyone in the room
            </button>
            <button
              onClick={() => {
                setMode('me')
                setStep('preferences')
              }}
              className="w-full bg-card border-2 border-border text-foreground py-6 rounded-lg font-medium hover:bg-accent transition-colors text-lg"
            >
              Just me
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'preferences') {
    return (
      <div className="max-w-4xl xl:max-w-5xl mx-auto">
        <div className="sticky top-0 z-10">
          <div className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 bg-background border-b border-border pointer-events-none" />
          <div className="relative max-w-4xl xl:max-w-5xl mx-auto p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep('who')}
                  className="flex items-center justify-center p-1.5 -ml-1 rounded-md hover:bg-accent transition-colors"
                  aria-label="Back"
                >
                  <DuotoneIcon icon={ArrowLeft} size={20} />
                </button>
                <h1 className="text-2xl font-bold text-foreground whitespace-nowrap leading-tight">Watch from</h1>
              </div>
              <RoomSelector />
            </div>
          </div>
        </div>
        <div className="p-4 bg-content min-h-[calc(100vh-200px)]">
          <h2 className="text-2xl font-bold mb-6 text-foreground">Preferences (all optional)</h2>

          <div className="space-y-6 mb-8">
            {mode === 'me' && (
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSeenAndNoExcitement}
                    onChange={(e) => setShowSeenAndNoExcitement(e.target.checked)}
                    className="w-5 h-5 rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">
                    Show me things other people have already seen and no one else is excited about
                  </span>
                </label>
              </div>
            )}

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
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border border-input rounded-md bg-background">
                  {(() => {
                    // Get genres based on content type preference
                    // When showing all types, merge and deduplicate by ID (Map uses first entry for duplicate keys)
                    const uniqueGenres = typePreference === 'movie' 
                      ? Object.entries(movieGenres)
                      : typePreference === 'show'
                      ? Object.entries(tvGenres)
                      : Array.from(
                          new Map([
                            ...Object.entries(movieGenres),
                            ...Object.entries(tvGenres)
                          ]).entries()
                        )
                    
                    return uniqueGenres.map(([id, name]) => {
                      const genreId = id
                      const isSelected = selectedGenres.includes(genreId)
                      return (
                        <label
                          key={genreId}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-secondary text-secondary-foreground border-input hover:bg-accent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedGenres([...selectedGenres, genreId])
                              } else {
                                setSelectedGenres(selectedGenres.filter((g) => g !== genreId))
                              }
                            }}
                            className="sr-only"
                          />
                          <span className="text-sm font-medium">{name}</span>
                        </label>
                      )
                    })
                  })()}
                </div>
                {selectedGenres.length > 0 && (
                  <button
                    onClick={() => setSelectedGenres([])}
                    className="text-sm text-primary hover:underline"
                  >
                    Clear all genres
                  </button>
                )}
              </div>
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
    <div className="max-w-4xl xl:max-w-5xl mx-auto">
      <div className="sticky top-0 z-10">
        <div className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 bg-background border-b border-border pointer-events-none" />
        <div className="relative max-w-4xl xl:max-w-5xl mx-auto p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep('preferences')}
                className="flex items-center justify-center p-1.5 -ml-1 rounded-md hover:bg-accent transition-colors"
                aria-label="Back"
              >
                <DuotoneIcon icon={ArrowLeft} size={20} />
              </button>
              <h1 className="text-2xl font-bold text-foreground whitespace-nowrap leading-tight">Watch from</h1>
              <RoomSelector />
            </div>
            <RoomMembersAvatars />
          </div>
        </div>
      </div>

      <div className="p-4 bg-content">
        <h2 className="text-2xl font-bold mb-2 text-foreground">Recommendations</h2>
        {recommendations.length > 0 && (
          <p className="text-muted-foreground mb-4">Based on the excitement levels and who&apos;s seen what, these are our recommendations for what you should watch.</p>
        )}
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
        <>
          <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] lg:w-full lg:left-0 lg:right-0 lg:ml-0 lg:mr-0">
          <div className="space-y-4 bg-content p-4">
            {recommendations.map((rec, index) => (
            <MediaCard
              key={rec.id}
              variant={index === 0 ? 'highlighted' : 'default'}
              className="relative"
            >
              {index === 0 && (
                <CardHeader>
                  <CardBadge>Top Pick</CardBadge>
                </CardHeader>
              )}

              <div
                onClick={(e) => {
                  e.stopPropagation()
                  setDetailModalItem(rec)
                  loadTrailer(rec)
                }}
                className="cursor-pointer"
              >
                <CardLayout>
                  <div className="pt-2">
                    <CardPoster src={rec.posterUrl} alt={rec.title} width={80} height={120} />
                  </div>
                  <CardContent className="pr-0 py-2">
                    <CardTitle>{rec.title}</CardTitle>
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
                    {rec.description && (
                      <CardDescription>{rec.description}</CardDescription>
                    )}
                  </CardContent>
                </CardLayout>
              </div>

              {mode === 'room' ? (
                <div className="text-sm text-muted-foreground -mx-4 px-4 pt-2 border-t border-border mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center -space-x-2">
                      {rec.interestedUsers.slice(0, 4).map((user) => {
                        const showImage = user.imageUrl
                        return (
                          <div
                            key={user.id}
                            className="relative w-6 h-6 rounded-full border-2 border-background overflow-hidden bg-muted flex-shrink-0"
                            title={user.name}
                          >
                            {showImage ? (
                              <Image
                                src={user.imageUrl!}
                                alt={user.name}
                                fill
                                className="object-cover"
                                sizes="24px"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center text-white text-xs font-medium"
                                style={{ backgroundColor: getAvatarColor(user.id || user.name) }}
                              >
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {rec.interestedUsers.length > 4 && (
                        <div
                          className="relative w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium text-foreground flex-shrink-0"
                          title={`${rec.interestedUsers.length - 4} more`}
                        >
                          +{rec.interestedUsers.length - 4}
                        </div>
                      )}
                    </div>
                    <p>
                      {rec.interestedCount === 1 && rec.interestedUsers[0]?.id === session?.user?.id
                        ? 'You are excited to watch this'
                        : `${rec.interestedCount} ${rec.interestedCount === 1 ? 'person is' : 'people are'} excited to watch this`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {rec.seenUsers.length > 0 ? (
                      <>
                        <div className="flex items-center -space-x-2">
                          {rec.seenUsers.slice(0, 4).map((user) => {
                            const showImage = user.imageUrl
                            return (
                              <div
                                key={user.id}
                                className="relative w-6 h-6 rounded-full border-2 border-background overflow-hidden bg-muted flex-shrink-0"
                                title={user.name}
                              >
                                {showImage ? (
                                  <Image
                                    src={user.imageUrl!}
                                    alt={user.name}
                                    fill
                                    className="object-cover"
                                    sizes="24px"
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full flex items-center justify-center text-white text-xs font-medium"
                                    style={{ backgroundColor: getAvatarColor(user.id || user.name) }}
                                  >
                                    {user.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                          {rec.seenUsers.length > 4 && (
                            <div
                              className="relative w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium text-foreground flex-shrink-0"
                              title={`${rec.seenUsers.length - 4} more`}
                            >
                              +{rec.seenUsers.length - 4}
                            </div>
                          )}
                        </div>
                        <p>
                          {rec.seenUsers.length === 1 && rec.seenUsers[0]?.id === session?.user?.id
                            ? 'You have seen this'
                            : `${rec.seenUsers.length} ${rec.seenUsers.length === 1 ? 'person has' : 'people have'} seen this`}
                        </p>
                      </>
                    ) : (
                      <p>No one has seen this yet</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground -mx-4 px-4 pt-2 border-t border-border mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center -space-x-2">
                      {rec.interestedUsers.slice(0, 4).map((user) => {
                        const showImage = user.imageUrl
                        return (
                          <div
                            key={user.id}
                            className="relative w-6 h-6 rounded-full border-2 border-background overflow-hidden bg-muted flex-shrink-0"
                            title={user.name}
                          >
                            {showImage ? (
                              <Image
                                src={user.imageUrl!}
                                alt={user.name}
                                fill
                                className="object-cover"
                                sizes="24px"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center text-white text-xs font-medium"
                                style={{ backgroundColor: getAvatarColor(user.id || user.name) }}
                              >
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {rec.interestedUsers.length > 4 && (
                        <div
                          className="relative w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium text-foreground flex-shrink-0"
                          title={`${rec.interestedUsers.length - 4} more`}
                        >
                          +{rec.interestedUsers.length - 4}
                        </div>
                      )}
                    </div>
                    <p>
                      {rec.interestedCount === 1 && rec.interestedUsers[0]?.id === session?.user?.id
                        ? 'You are excited to watch this'
                        : `${rec.interestedCount} ${rec.interestedCount === 1 ? 'person is' : 'people are'} excited to watch this`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {rec.seenUsers && rec.seenUsers.length > 0 ? (
                      <>
                        <div className="flex items-center -space-x-2">
                          {rec.seenUsers.slice(0, 4).map((user) => {
                            const showImage = user.imageUrl
                            return (
                              <div
                                key={user.id}
                                className="relative w-6 h-6 rounded-full border-2 border-background overflow-hidden bg-muted flex-shrink-0"
                                title={user.name}
                              >
                                {showImage ? (
                                  <Image
                                    src={user.imageUrl!}
                                    alt={user.name}
                                    fill
                                    className="object-cover"
                                    sizes="24px"
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full flex items-center justify-center text-white text-xs font-medium"
                                    style={{ backgroundColor: getAvatarColor(user.id || user.name) }}
                                  >
                                    {user.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                          {rec.seenUsers.length > 4 && (
                            <div
                              className="relative w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium text-foreground flex-shrink-0"
                              title={`${rec.seenUsers.length - 4} more`}
                            >
                              +{rec.seenUsers.length - 4}
                            </div>
                          )}
                        </div>
                        <p>
                          {rec.seenUsers.length === 1 && rec.seenUsers[0]?.id === session?.user?.id
                            ? 'You have seen this'
                            : `${rec.seenUsers.length} ${rec.seenUsers.length === 1 ? 'person has' : 'people have'} seen this`}
                        </p>
                      </>
                    ) : (
                      <p>No one has seen this yet</p>
                    )}
                  </div>
                </div>
              )}

              <CardActions>
                <div className="flex flex-col items-start gap-2">
                  <button
                    onClick={() => handleSelectItem(rec)}
                    className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-medium hover:bg-primary/90"
                  >
                    Where can I watch this?
                  </button>
                  <button
                    onClick={() => handleMarkAsWatched(rec.id)}
                    disabled={markingWatchedId === rec.id}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {markingWatchedId === rec.id ? 'Marking as watched...' : 'Mark as watched'}
                  </button>
                </div>
              </CardActions>
            </MediaCard>
            ))}
          </div>
        </div>
        </>
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

      {detailModalItem && (
        <DetailModal
          item={detailModalItem}
          trailerUrl={trailerUrl}
          loadingTrailer={loadingTrailer}
          onClose={() => {
            setDetailModalItem(null)
            setTrailerUrl(null)
          }}
        />
      )}
    </div>
  )
}

function DetailModal({
  item,
  trailerUrl,
  loadingTrailer,
  onClose,
}: {
  item: Recommendation
  trailerUrl: string | null
  loadingTrailer: boolean
  onClose: () => void
}) {
  const { isClosing, handleClose } = useModalAnimation(onClose)

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center pt-4 px-4 pb-20 modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div 
        className={`bg-card rounded-lg max-w-4xl w-full h-[calc(100vh-6rem)] flex flex-col modal-content relative ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={handleClose} 
          className="absolute top-4 right-4 z-10 text-muted-foreground text-2xl hover:text-foreground"
        >
          ×
        </button>
        <div className="p-6 pt-4 overflow-y-auto flex-1">
          <div className="mb-4 pr-8">
            <h2 className="text-2xl font-bold text-foreground">{item.title}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {item.posterUrl && (
              <div className="flex-shrink-0">
                <Image
                  src={item.posterUrl}
                  alt={item.title}
                  width={300}
                  height={450}
                  className="rounded object-cover w-full"
                />
              </div>
            )}

            <div className="space-y-4">
              {item.description && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Description</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              )}

              {item.genres.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Genres</h3>
                  <div className="flex flex-wrap gap-2">
                    {item.genres.map((genre, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-secondary text-muted-foreground text-xs rounded"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {item.releaseDate && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Release Date</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(item.releaseDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}

              {item.rating && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Rating</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    {item.rating.toFixed(1)} / 10
                  </p>
                </div>
              )}
            </div>
          </div>

          {loadingTrailer ? (
            <div className="mb-6">
              <div className="bg-muted rounded-lg aspect-video flex items-center justify-center">
                <p className="text-muted-foreground">Loading trailer...</p>
              </div>
            </div>
          ) : trailerUrl ? (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2 text-foreground">Trailer</h3>
              <div className="bg-black rounded-lg overflow-hidden aspect-video">
                <iframe
                  src={trailerUrl}
                  title={`${item.title} Trailer`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          ) : item.tmdbId && item.sourceType?.toLowerCase() === 'tmdb' ? (
            <div className="mb-6">
              <div className="bg-muted rounded-lg aspect-video flex items-center justify-center">
                <p className="text-muted-foreground">No trailer available</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

