'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  Film,
  Link as LinkIcon,
  Popcorn,
  Sparkles,
  Tv,
  User,
  Users,
  Video,
} from 'lucide-react'
import { RoomSelector } from '@/components/RoomSelector'
import { RoomMembersAvatars } from '@/components/RoomMembersAvatars'
import {
  pageContainerClassName,
  PageContent,
  PageHeader,
  PageHeaderBar,
  useSelectedRoomName,
} from '@/components/PageHeader'
import { BackButton } from '@/components/ui/back-button'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChoiceCard } from '@/components/ui/choice-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Modal, ModalBody, ModalHeader } from '@/components/ui/modal'
import { Notice } from '@/components/ui/notice'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { notifyRoomsChanged } from '@/lib/rooms'
import { movieGenres, tvGenres } from '@/lib/tmdb-genres'
import { FavoriteButton, FavoritedByBadge, favoritedByLabel } from '@/components/FavoriteButton'
import { SubmissionInfo, SubmissionMeta } from '@/components/SubmissionMeta'
import { MediaDetailBody } from '@/components/MediaDetail'
import {
  HouseholdExcitementRow,
  HouseholdMember,
  HouseholdPreference,
  HouseholdUser,
} from '@/components/HouseholdExcitementRow'
import {
  CardActions,
  CardBadge,
  CardContent,
  CardDescription,
  CardGenres,
  CardHeader,
  CardLayout,
  CardMeta,
  CardPoster,
  CardTitle,
  MediaCard,
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
  isFavorite?: boolean
  favoritedBy?: string[]
  interestedCount: number
  avgExcitement: number
  myPreference: HouseholdPreference | null
  otherPreferences: HouseholdMember[]
  submission?: SubmissionInfo | null
}

interface RecommendationParams {
  roomId: string | null
  mode: 'me' | 'room'
  typePreference: string
  genres: string[]
  showSeenAndNoExcitement: boolean
}

type FetchOutcome = 'ok' | 'error' | 'stale'

export default function WatchPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')
  const isWatchedRoom = roomId === 'watched'
  const selectedRoomName = useSelectedRoomName()
  const watchSubtitle = selectedRoomName
    ? `Pick something for ${selectedRoomName} tonight.`
    : 'Pick something to put on tonight.'

  const [step, setStep] = useState<'who' | 'preferences' | 'results'>('who')
  const [mode, setMode] = useState<'me' | 'room'>('me')
  const [typePreference, setTypePreference] = useState('any')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  // Off by default: Just Me ranks everything the viewer hasn't watched. On,
  // it narrows to titles others have already seen (see the option's label).
  const [showSeenAndNoExcitement, setShowSeenAndNoExcitement] = useState(false)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [detailModalItem, setDetailModalItem] = useState<Recommendation | null>(null)
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null)
  const [loadingTrailer, setLoadingTrailer] = useState(false)
  const [markingWatchedId, setMarkingWatchedId] = useState<string | null>(null)
  const [myAvatar, setMyAvatar] = useState<string | null>(null)
  const prevTypePreferenceRef = useRef<string>(typePreference)
  // Generation counter + AbortController so an older in-flight response can
  // never overwrite results from a newer request (rapid room switching).
  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  // Room the current results were fetched for; the results-step effect only
  // refetches when the URL room diverges from this.
  const resultsRoomIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    // Users without rooms still get Just Me picks from their personal catalog.
  }, [session, status, router])

  // The session only carries id/name; the avatar lives on the profile.
  useEffect(() => {
    if (!session?.user?.id) return
    let cancelled = false
    fetch('/api/user/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setMyAvatar(data?.user?.imageUrl || null)
      })
      .catch(() => {
        if (!cancelled) setMyAvatar(null)
      })
    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  const viewer: HouseholdUser | null = session?.user?.id
    ? { id: session.user.id, name: session.user.name || 'You', imageUrl: myAvatar }
    : null

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

  const cancelInFlightRequest = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    requestIdRef.current += 1
  }, [])

  const fetchRecommendations = useCallback(
    async (params: RecommendationParams): Promise<FetchOutcome> => {
      cancelInFlightRequest()
      const controller = new AbortController()
      abortRef.current = controller
      const requestId = requestIdRef.current
      resultsRoomIdRef.current = params.roomId

      setLoading(true)
      setFetchError(null)
      try {
        const url = new URL('/api/recommendations', window.location.origin)
        // A null roomId (no query param) means "Just My Stuff" to the API.
        if (params.roomId) {
          url.searchParams.set('roomId', params.roomId)
        }

        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: params.mode,
            typePreference: params.typePreference,
            genres: params.genres,
            showSeenAndNoExcitement: params.mode === 'me'
              ? params.showSeenAndNoExcitement
              : undefined,
          }),
          signal: controller.signal,
        })
        const data = await res.json().catch(() => ({}))

        if (requestId !== requestIdRef.current) return 'stale'

        if (!res.ok || !Array.isArray(data.recommendations)) {
          setFetchError(data.error || 'Failed to get recommendations. Please try again.')
          return 'error'
        }
        setRecommendations(data.recommendations)
        return 'ok'
      } catch (err) {
        if (requestId !== requestIdRef.current) return 'stale'
        console.error('Failed to get recommendations:', err)
        setFetchError('Failed to get recommendations. Please try again.')
        return 'error'
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    },
    [cancelInFlightRequest],
  )

  const currentParams: RecommendationParams = {
    roomId,
    mode,
    typePreference,
    genres: selectedGenres,
    showSeenAndNoExcitement,
  }

  const handleGetRecommendations = async () => {
    if (isWatchedRoom) {
      cancelInFlightRequest()
      resultsRoomIdRef.current = roomId
      setFetchError(null)
      setStep('results')
      return
    }
    const outcome = await fetchRecommendations(currentParams)
    if (outcome === 'ok') {
      setStep('results')
    }
  }

  // Changing the room from the header dropdown while on results re-runs the
  // same query against the new room. Preference changes never reach here
  // because they can only be made on the preferences step.
  useEffect(() => {
    if (step !== 'results') return
    if (roomId === resultsRoomIdRef.current) return
    // RoomSelector redirects a missing roomId to all-rooms; wait for it.
    if (roomId === null) return

    if (roomId === 'watched') {
      cancelInFlightRequest()
      resultsRoomIdRef.current = roomId
      setLoading(false)
      setFetchError(null)
      return
    }

    fetchRecommendations({
      roomId,
      mode,
      typePreference,
      genres: selectedGenres,
      showSeenAndNoExcitement,
    })
  }, [
    step,
    roomId,
    mode,
    typePreference,
    selectedGenres,
    showSeenAndNoExcitement,
    fetchRecommendations,
    cancelInFlightRequest,
  ])

  useEffect(() => cancelInFlightRequest, [cancelInFlightRequest])

  const handleSelectItem = (item: Recommendation) => {
    const searchQuery = `Where can I watch ${item.title}`
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`

    window.open(searchUrl, '_blank', 'noopener,noreferrer,popup=yes')
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
      notifyRoomsChanged()
    } catch (err) {
      console.error('Failed to mark as watched:', err)
      alert('Failed to mark title as watched')
    } finally {
      setMarkingWatchedId(null)
    }
  }

  // Ranking is server-side; the list keeps its order until the next fetch.
  const applyFavorite = (itemId: string, isFavorite: boolean) => {
    const patch = (rec: Recommendation): Recommendation =>
      rec.id !== itemId ? rec : { ...rec, isFavorite }
    setRecommendations((prev) => prev.map(patch))
    setDetailModalItem((prev) => (prev ? patch(prev) : prev))
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

  const header = (leading?: React.ReactNode, right?: React.ReactNode) => (
    <PageHeaderBar>
      <PageHeader title='Watch from' subtitle={watchSubtitle} leading={leading} right={right}>
        <RoomSelector />
      </PageHeader>
    </PageHeaderBar>
  )

  if (step === 'who') {
    return (
      <div className={pageContainerClassName}>
        {header()}
        <PageContent>
          <h2 className='mb-4 text-xl font-bold text-foreground'>Who&apos;s watching?</h2>

          <div className='grid gap-3 sm:grid-cols-2'>
            <ChoiceCard
              icon={Users}
              title='Everyone in the room'
              description="Balances what the whole household is excited about and hasn't seen."
              primary
              onClick={() => {
                setMode('room')
                setStep('preferences')
              }}
            />
            <ChoiceCard
              icon={User}
              title='Just me'
              description="Ranks by your own excitement, from everything you haven't watched."
              onClick={() => {
                setMode('me')
                setStep('preferences')
              }}
            />
          </div>
        </PageContent>
      </div>
    )
  }

  if (step === 'preferences') {
    return (
      <div className={pageContainerClassName}>
        {header(<BackButton onClick={() => setStep('who')} />)}
        <PageContent>
          <h2 className='mb-1 text-xl font-bold text-foreground'>Preferences</h2>
          <p className='mb-5 text-sm text-muted-foreground'>All optional.</p>

          <Card className='mb-5 space-y-5'>
            {mode === 'me' && (
              <label className='flex cursor-pointer items-start gap-3'>
                <input
                  type='checkbox'
                  checked={showSeenAndNoExcitement}
                  onChange={(e) => setShowSeenAndNoExcitement(e.target.checked)}
                  className='mt-0.5 h-5 w-5 flex-shrink-0 rounded border-input text-primary focus:ring-primary'
                />
                <span className='min-w-0'>
                  <span className='block text-sm font-medium text-foreground'>
                    Only titles others have already seen
                  </span>
                  <span className='mt-0.5 block text-xs text-muted-foreground'>
                    Narrows your picks to titles at least one other member has seen and nobody else
                    still wants to watch — good for solo nights that won&apos;t leave anyone out.
                  </span>
                </span>
              </label>
            )}

            <Field label='Content type' htmlFor='watch-type'>
              <Select
                id='watch-type'
                value={typePreference}
                onChange={(e) => setTypePreference(e.target.value)}
              >
                <option value='any'>No preference</option>
                <option value='movie'>Movie</option>
                <option value='show'>Show</option>
              </Select>
            </Field>

            <div>
              <div className='mb-2 flex items-center justify-between'>
                <span className='text-sm font-medium text-foreground'>Genres</span>
                {selectedGenres.length > 0 && (
                  <button
                    type='button'
                    onClick={() => setSelectedGenres([])}
                    className='text-sm font-medium text-foreground underline-offset-4 hover:underline'
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className='flex max-h-48 flex-wrap gap-2 overflow-y-auto'>
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
                        ...Object.entries(tvGenres),
                      ]).entries(),
                    )

                  return uniqueGenres.map(([id, name]) => {
                    const genreId = id
                    const isSelected = selectedGenres.includes(genreId)
                    return (
                      <label
                        key={genreId}
                        className={cn(
                          'flex min-h-[36px] cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input bg-background text-foreground hover:bg-accent',
                        )}
                      >
                        <input
                          type='checkbox'
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGenres([...selectedGenres, genreId])
                            } else {
                              setSelectedGenres(selectedGenres.filter((g) => g !== genreId))
                            }
                          }}
                          className='sr-only'
                        />
                        {name}
                      </label>
                    )
                  })
                })()}
              </div>
            </div>
          </Card>

          <Button
            onClick={handleGetRecommendations}
            disabled={loading}
            size='lg'
            className='w-full'
          >
            {loading ? 'Finding recommendations...' : 'Show me something'}
          </Button>
          {fetchError && (
            <p role='alert' className='mt-3 text-center text-sm text-destructive'>
              {fetchError}
            </p>
          )}
        </PageContent>
      </div>
    )
  }

  return (
    <div className={pageContainerClassName}>
      {header(<BackButton onClick={() => setStep('preferences')} />, <RoomMembersAvatars />)}

      <PageContent>
        <h2 className='mb-1 text-xl font-bold text-foreground'>Recommendations</h2>
        {!isWatchedRoom && recommendations.length > 0 && (
          <p className='mb-4 text-sm text-muted-foreground'>
            Based on the excitement levels and who&apos;s seen what, these are our recommendations
            for what you should watch.
          </p>
        )}
        {!isWatchedRoom && loading && recommendations.length > 0 && (
          <p className='mb-4 text-sm text-muted-foreground' aria-live='polite'>
            Finding recommendations...
          </p>
        )}
        {!isWatchedRoom && fetchError && (
          <Notice variant='error' className='mb-4'>
            <span role='alert'>
              {fetchError}{' '}
              <button
                onClick={() => fetchRecommendations(currentParams)}
                className='font-medium underline underline-offset-4'
              >
                Try again
              </button>
            </span>
          </Notice>
        )}

        {isWatchedRoom
          ? (
            <EmptyState
              icon={Eye}
              title='Nothing to suggest from Watched'
              description="Watch picks from titles you haven't seen yet."
              action={
                <Button
                  variant='outline'
                  onClick={() => router.push(`${pathname}?roomId=all-rooms`)}
                >
                  Switch to All Rooms
                </Button>
              }
            />
          )
          : loading && recommendations.length === 0
          ? (
            <div className='py-12 text-center text-sm text-muted-foreground' aria-live='polite'>
              <p>Finding recommendations...</p>
            </div>
          )
          : recommendations.length === 0
          ? fetchError ? null : (
            <EmptyState
              icon={Popcorn}
              title='No recommendations found'
              description='Try adjusting your preferences.'
              action={
                <Button
                  variant='outline'
                  onClick={() => setStep('preferences')}
                >
                  Go back
                </Button>
              }
            />
          )
          : (
            <div
              className={cn(
                'space-y-4 transition-opacity',
                loading && 'pointer-events-none opacity-50',
              )}
              aria-busy={loading}
            >
              {recommendations.map((rec, index) => (
                <MediaCard
                  key={rec.id}
                  variant={index === 0 ? 'highlighted' : 'default'}
                  className='relative'
                >
                  {index === 0 && (
                    <CardHeader>
                      <CardBadge>
                        <Sparkles className='h-3 w-3' />
                        Top pick
                      </CardBadge>
                    </CardHeader>
                  )}

                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      setDetailModalItem(rec)
                      loadTrailer(rec)
                    }}
                    className='cursor-pointer'
                  >
                    <CardLayout>
                      <CardPoster src={rec.posterUrl} alt={rec.title} width={80} height={120} />
                      <CardContent>
                        <CardTitle>{rec.title}</CardTitle>
                        <CardMeta
                          icon={getTypeIcon(rec.type)}
                          type={rec.type}
                          releaseDate={rec.releaseDate}
                        />
                        <CardGenres genres={rec.genres} maxDisplay={3} />
                        {rec.description && <CardDescription>{rec.description}</CardDescription>}
                      </CardContent>
                    </CardLayout>
                  </div>

                  {(rec.otherPreferences.length > 0 ||
                    (rec.favoritedBy && rec.favoritedBy.length > 0)) && (
                    <div className='mt-3 space-y-2 border-t border-border pt-3 text-sm text-muted-foreground'>
                      <HouseholdExcitementRow
                        myPreference={rec.myPreference}
                        viewer={viewer}
                        otherPreferences={rec.otherPreferences}
                      />
                      {rec.favoritedBy && rec.favoritedBy.length > 0 && (
                        <div className='flex items-center gap-2'>
                          <FavoritedByBadge names={rec.favoritedBy} />
                          <p>{favoritedByLabel(rec.favoritedBy)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <CardActions className='flex items-center justify-between gap-2'>
                    <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2'>
                      <Button onClick={() => handleSelectItem(rec)} size='sm'>
                        <ExternalLink className='h-4 w-4' />
                        Where can I watch this?
                      </Button>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => handleMarkAsWatched(rec.id)}
                        disabled={markingWatchedId === rec.id}
                        className='-ml-2 text-muted-foreground hover:text-foreground'
                      >
                        <CheckCircle2 className='h-4 w-4' />
                        {markingWatchedId === rec.id ? 'Marking as watched...' : 'Mark as watched'}
                      </Button>
                    </div>
                    <FavoriteButton
                      mediaItemId={rec.id}
                      isFavorite={rec.isFavorite === true}
                      onChange={(isFavorite) => applyFavorite(rec.id, isFavorite)}
                      className='-mr-2'
                    />
                  </CardActions>
                </MediaCard>
              ))}
            </div>
          )}
      </PageContent>

      {detailModalItem && (
        <DetailModal
          item={detailModalItem}
          viewer={viewer}
          trailerUrl={trailerUrl}
          loadingTrailer={loadingTrailer}
          onFavoriteChange={(isFavorite) => applyFavorite(detailModalItem.id, isFavorite)}
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
  viewer,
  trailerUrl,
  loadingTrailer,
  onFavoriteChange,
  onClose,
}: {
  item: Recommendation
  viewer: HouseholdUser | null
  trailerUrl: string | null
  loadingTrailer: boolean
  onFavoriteChange: (isFavorite: boolean) => void
  onClose: () => void
}) {
  return (
    <Modal isOpen onClose={onClose} size='xl' tall aria-label={item.title}>
      <ModalHeader
        title={item.title}
        action={
          <FavoriteButton
            mediaItemId={item.id}
            isFavorite={item.isFavorite === true}
            onChange={onFavoriteChange}
            size={22}
            className='-mt-1.5'
          />
        }
        description={<SubmissionMeta submission={item.submission} />}
      />
      <ModalBody className='pb-6'>
        {item.otherPreferences.length > 0 && (
          <div className='mb-6'>
            <h3 className='mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
              Who wants to watch
            </h3>
            <HouseholdExcitementRow
              myPreference={item.myPreference}
              viewer={viewer}
              otherPreferences={item.otherPreferences}
            />
          </div>
        )}
        <MediaDetailBody item={item} trailerUrl={trailerUrl} loadingTrailer={loadingTrailer} />
      </ModalBody>
    </Modal>
  )
}
