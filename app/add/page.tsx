'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  Film,
  Link as LinkIcon,
  Lock,
  Pencil,
  Search,
  SearchX,
  Tv,
  User,
  Video,
} from 'lucide-react'
import { BrandVideo } from '@/components/BrandVideo'
import { InlineLoading } from '@/components/LoadingScreen'
import { MediaCardSkeletonList } from '@/components/MediaCardSkeleton'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MenuItem, MenuPanel, MenuTrigger } from '@/components/ui/menu'
import { Notice } from '@/components/ui/notice'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import { isVirtualRoomId, notifyRoomsChanged } from '@/lib/rooms'
import { clientSubmissionContext } from '@/lib/submission-context'
import {
  CardContent,
  CardDescription,
  CardGenres,
  CardLayout,
  CardMenu,
  CardMeta,
  CardPoster,
  CardTitle,
  MediaCard,
} from '@/components/MediaCard'
import { getGenreNames } from '@/lib/tmdb-genres'
import { cn } from '@/lib/utils'

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

interface TMDBResultVia {
  personId: number
  name: string
  role?: string | null
}

interface TMDBResult {
  id: number
  title: string
  releaseDate?: string
  posterPath?: string | null
  type: 'movie' | 'show'
  overview?: string
  genreIds?: number[]
  source?: 'title' | 'person'
  via?: TMDBResultVia
}

function getViaLabel(via: TMDBResultVia) {
  switch (via.role) {
    case 'Director':
      return `Directed by ${via.name}`
    case 'Writer':
      return `Written by ${via.name}`
    case 'Creator':
      return `Created by ${via.name}`
    case 'Actor':
      return `Starring ${via.name}`
    default:
      return `Because of ${via.name}`
  }
}

interface TMDBDetails {
  id: number
  title: string
  type: 'movie' | 'show'
  overview?: string
  posterUrl?: string
  genres: string[]
  runtimeMinutes?: number
  rating?: number
  releaseDate?: string
}

export default function AddPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')
  const selectedRoomName = useSelectedRoomName()
  // Watched and No rooms yet are views, not places to put a title, so adding
  // from either lands in the personal catalog like Just My Stuff does.
  const addsToNoRoom = !roomId || roomId === 'watched' || roomId === 'no-rooms'

  const [mode, setMode] = useState<'search' | 'manual' | 'confirm'>('search')
  const searchParam = searchParams.get('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([])
  const [selectedResult, setSelectedResult] = useState<TMDBDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasAutoSearched, setHasAutoSearched] = useState(false)
  const [lastSearchedQuery, setLastSearchedQuery] = useState<string>('')
  // Adding keeps you on this tab so you can add several titles in a row:
  // results already added are marked, and the last one gets a confirmation.
  const [addedResultKeys, setAddedResultKeys] = useState<Set<string>>(() => new Set())
  const [lastAddedTitle, setLastAddedTitle] = useState<string | null>(null)
  const searchScrollYRef = useRef(0)

  // Sync search param to search query
  useEffect(() => {
    if (searchParam) {
      setSearchQuery(searchParam)
      setHasAutoSearched(false) // Reset so we can auto-search again if param changes
      setLastSearchedQuery('') // Reset last searched query when search param changes
    }
  }, [searchParam])

  // Form state
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'movie' | 'show' | 'other'>('movie')
  const [externalUrl, setExternalUrl] = useState('')
  const [description, setDescription] = useState('')
  const [genres, setGenres] = useState('')
  const [recommendedByName, setRecommendedByName] = useState('')
  const [recommendationContext, setRecommendationContext] = useState('')
  const [status, setStatus] = useState('have_not_seen')
  const [excitement, setExcitement] = useState(5)
  const [isConfirmDetailsEditable, setIsConfirmDetailsEditable] = useState(false)
  const [isConfirmMenuOpen, setIsConfirmMenuOpen] = useState(false)
  const confirmMenuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (sessionStatus === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    // Allow users to add items even without rooms - they can add to "Just My Stuff"
    // The API will handle creating a default room if needed
  }, [session, sessionStatus, router])

  useEffect(() => {
    if (!isConfirmMenuOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (!confirmMenuRef.current?.contains(event.target as Node)) {
        setIsConfirmMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isConfirmMenuOpen])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setSearchResults([])
    setLastAddedTitle(null)
    setLastSearchedQuery(searchQuery.trim())
    try {
      const res = await fetch(
        `/api/tmdb/search?query=${encodeURIComponent(searchQuery)}&type=mixed`,
      )

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({
          error: `Error: ${res.status} ${res.statusText}`,
        }))
        console.error('Search API error:', errorData)
        alert(errorData.error || 'Search failed. Please try again.')
        return
      }

      const data = await res.json()
      if (data.results && Array.isArray(data.results)) {
        setSearchResults(data.results)
        if (data.results.length === 0) {
          console.log('No results found for query:', searchQuery)
        }
      } else {
        console.error('Unexpected response format:', data)
        setSearchResults([])
      }
    } catch (err) {
      console.error('Search failed:', err)
      alert('Search failed. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [searchQuery])

  // Auto-search when search param is provided
  useEffect(() => {
    if (
      searchParam && !hasAutoSearched && sessionStatus === 'authenticated' && session &&
      searchQuery.trim()
    ) {
      setHasAutoSearched(true)
      handleSearch()
    }
  }, [searchParam, hasAutoSearched, session, sessionStatus, searchQuery, handleSearch])

  // Back on the results list, land where you were before opening a title.
  useEffect(() => {
    if (mode === 'search') window.scrollTo(0, searchScrollYRef.current)
  }, [mode])

  const resetForm = () => {
    setSelectedResult(null)
    setTitle('')
    setType('movie')
    setExternalUrl('')
    setDescription('')
    setGenres('')
    setRecommendedByName('')
    setRecommendationContext('')
    setStatus('have_not_seen')
    setExcitement(5)
    setIsConfirmDetailsEditable(false)
    setIsConfirmMenuOpen(false)
  }

  const handleAdded = () => {
    notifyRoomsChanged()
    if (selectedResult) {
      const key = `${selectedResult.type}-${selectedResult.id}`
      setAddedResultKeys((prev) => new Set(prev).add(key))
    }
    setLastAddedTitle(title || 'Title')
    resetForm()
    setMode('search')
  }

  const openManual = () => {
    searchScrollYRef.current = window.scrollY
    setLastAddedTitle(null)
    if (searchQuery) setTitle(searchQuery)
    setMode('manual')
  }

  const handleSelectResult = async (result: TMDBResult) => {
    searchScrollYRef.current = window.scrollY
    setLastAddedTitle(null)
    setLoading(true)
    try {
      const res = await fetch(
        `/api/tmdb/details?id=${result.id}&type=${result.type === 'movie' ? 'movie' : 'tv'}`,
      )
      const data = await res.json()

      setSelectedResult(data)
      setTitle(data.title)
      setType(data.type === 'movie' ? 'movie' : 'show')
      setDescription(data.overview || '')
      setGenres(data.genres?.join(', ') || '')
      setIsConfirmDetailsEditable(false)
      setIsConfirmMenuOpen(false)
      setMode('confirm')
    } catch (err) {
      console.error('Failed to fetch details:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    try {
      const genreArray = genres
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean)

      const payload = {
        title,
        type,
        tmdbId: selectedResult?.id || null,
        sourceType: selectedResult ? 'tmdb' : 'manual',
        externalUrl: externalUrl || null,
        posterUrl: selectedResult?.posterUrl || null,
        description: description || null,
        genres: genreArray,
        runtimeMinutes: selectedResult?.runtimeMinutes || null,
        rating: selectedResult?.rating || null,
        releaseDate: selectedResult?.releaseDate || null,
        status,
        excitement: parseInt(excitement.toString()),
        notes: null,
        recommendedByName: recommendedByName || null,
        recommendationContext: recommendationContext || null,
        ...clientSubmissionContext(),
      }

      // If "all-rooms" is selected, add to all rooms
      if (roomId === 'all-rooms') {
        const res = await fetch('/api/rooms/all-rooms/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          handleAdded()
        } else {
          let errorMessage = 'Failed to add item'
          try {
            const text = await res.text()
            if (text) {
              const data = JSON.parse(text)
              errorMessage = data.error || errorMessage
            } else {
              errorMessage = `Error: ${res.status} ${res.statusText}`
            }
          } catch (parseError) {
            errorMessage = `Error: ${res.status} ${res.statusText}`
          }
          alert(errorMessage)
        }
      } else if (addsToNoRoom) {
        // "Just My Stuff" - create item without adding it to any room
        const res = await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          handleAdded()
        } else {
          let errorMessage = 'Failed to add item'
          try {
            const text = await res.text()
            if (text) {
              const data = JSON.parse(text)
              errorMessage = data.error || errorMessage
            } else {
              errorMessage = `Error: ${res.status} ${res.statusText}`
            }
          } catch (parseError) {
            errorMessage = `Error: ${res.status} ${res.statusText}`
          }
          alert(errorMessage)
        }
      } else {
        const res = await fetch(`/api/rooms/${roomId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          handleAdded()
        } else {
          let errorMessage = 'Failed to add item'
          try {
            const text = await res.text()
            if (text) {
              const data = JSON.parse(text)
              errorMessage = data.error || errorMessage
            } else {
              errorMessage = `Error: ${res.status} ${res.statusText}`
            }
          } catch (parseError) {
            errorMessage = `Error: ${res.status} ${res.statusText}`
          }
          alert(errorMessage)
        }
      }
    } catch (err) {
      console.error('Failed to add item:', err)
      alert('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Allow null roomId ("Just My Stuff"), "all-rooms", or any valid roomId
  // Only show loading if we're checking for rooms (which happens in useEffect)
  // The page can render with null roomId
  const parsedGenres = genres
    .split(',')
    .map((genre) => genre.trim())
    .filter(Boolean)

  const submitLabel = loading
    ? 'Adding...'
    : roomId === 'all-rooms'
    ? 'Add to All Rooms'
    : addsToNoRoom
    ? 'Add to My Stuff'
    : 'Add to Room'

  const titleAndTypeFields = (
    <>
      <Field label='Title' htmlFor='add-title' required>
        <Input
          id='add-title'
          type='text'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </Field>

      <Field label='Type' htmlFor='add-type' required>
        <Select id='add-type' value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value='movie'>Movie</option>
          <option value='show'>Show</option>
          <option value='other'>Other</option>
        </Select>
      </Field>
    </>
  )

  const externalUrlField = (
    <Field label='External URL' htmlFor='add-url' help='Optional'>
      <Input
        id='add-url'
        type='url'
        value={externalUrl}
        onChange={(e) => setExternalUrl(e.target.value)}
        placeholder='https://...'
      />
    </Field>
  )

  const descriptionAndGenresFields = (
    <>
      <Field label='Description' htmlFor='add-description'>
        <Textarea
          id='add-description'
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </Field>

      <Field label='Genres' htmlFor='add-genres' help='Comma-separated'>
        <Input
          id='add-genres'
          type='text'
          value={genres}
          onChange={(e) => setGenres(e.target.value)}
        />
      </Field>
    </>
  )

  const recommendationAndRatingFields = (
    <>
      <Field label='Recommended by' htmlFor='add-recommended-by'>
        <Input
          id='add-recommended-by'
          type='text'
          value={recommendedByName}
          onChange={(e) => setRecommendedByName(e.target.value)}
          placeholder='Name'
        />
      </Field>

      <Field label='Recommendation notes' htmlFor='add-recommendation-notes'>
        <Textarea
          id='add-recommendation-notes'
          value={recommendationContext}
          onChange={(e) => setRecommendationContext(e.target.value)}
          rows={2}
          placeholder='Why was this recommended?'
        />
      </Field>

      <div className='grid gap-4 sm:grid-cols-2'>
        <Field label='My status' htmlFor='add-status' required>
          <Select id='add-status' value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value='have_not_seen'>Have not seen</option>
            <option value='already_seen'>Already seen</option>
          </Select>
        </Field>

        <Field label='My excitement' htmlFor='add-excitement' required>
          <Select
            id='add-excitement'
            value={excitement}
            onChange={(e) => setExcitement(parseInt(e.target.value))}
          >
            <option value={1}>Not excited</option>
            <option value={3}>Neutral</option>
            <option value={5}>Excited</option>
          </Select>
        </Field>
      </div>
    </>
  )

  if (mode === 'confirm') {
    return (
      <div className={pageContainerClassName}>
        <PageHeaderBar>
          <PageHeader
            title='Confirm'
            leading={
              <BackButton
                onClick={() => {
                  setMode('search')
                  setSelectedResult(null)
                  setIsConfirmMenuOpen(false)
                }}
                label='Back to search'
              />
            }
          >
            <RoomSelector />
          </PageHeader>
        </PageHeaderBar>

        <PageContent>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <MediaCard className='relative'>
              <div ref={confirmMenuRef}>
                <CardMenu>
                  <MenuTrigger
                    label='Menu'
                    aria-expanded={isConfirmMenuOpen}
                    onClick={() => setIsConfirmMenuOpen((prev) => !prev)}
                  />
                  {isConfirmMenuOpen && (
                    <MenuPanel>
                      <MenuItem
                        icon={isConfirmDetailsEditable ? Lock : Pencil}
                        onClick={() => {
                          setIsConfirmDetailsEditable((prev) => !prev)
                          setIsConfirmMenuOpen(false)
                        }}
                      >
                        {isConfirmDetailsEditable ? 'Lock details' : 'Edit details'}
                      </MenuItem>
                    </MenuPanel>
                  )}
                </CardMenu>
              </div>

              {isConfirmDetailsEditable
                ? <div className='space-y-4 pr-10'>{titleAndTypeFields}</div>
                : (
                  <>
                    <input
                      type='text'
                      value={title}
                      readOnly
                      required
                      className='hidden'
                      aria-hidden
                    />
                    <CardLayout>
                      <CardPoster
                        src={selectedResult?.posterUrl || null}
                        alt={title || 'Selected title'}
                        width={80}
                        height={120}
                      />
                      <CardContent className='pr-10'>
                        <CardTitle className='text-xl'>{title || 'Untitled'}</CardTitle>
                        <CardMeta
                          icon={getTypeIcon(type)}
                          type={type}
                          releaseDate={selectedResult?.releaseDate}
                          runtimeMinutes={selectedResult?.runtimeMinutes}
                        />
                        {parsedGenres.length > 0 && (
                          <CardGenres genres={parsedGenres} maxDisplay={8} />
                        )}
                        {description
                          ? (
                            <CardDescription lineClamp={0} className='mt-2 mb-0'>
                              {description}
                            </CardDescription>
                          )
                          : (
                            <p className='mt-2 text-sm text-muted-foreground'>
                              No description yet
                            </p>
                          )}
                      </CardContent>
                    </CardLayout>
                  </>
                )}
            </MediaCard>

            {(!selectedResult || isConfirmDetailsEditable) && (
              <Card className='space-y-4'>
                {!selectedResult && externalUrlField}
                {isConfirmDetailsEditable && descriptionAndGenresFields}
              </Card>
            )}

            <Card className='space-y-4'>
              {recommendationAndRatingFields}
            </Card>

            <Button type='submit' size='lg' disabled={loading} className='w-full'>
              {submitLabel}
            </Button>
          </form>
        </PageContent>
      </div>
    )
  }

  if (mode === 'manual') {
    return (
      <div className={pageContainerClassName}>
        <PageHeaderBar>
          <PageHeader
            title='Add manually'
            leading={<BackButton onClick={() => setMode('search')} label='Back to search' />}
          >
            <RoomSelector />
          </PageHeader>
        </PageHeaderBar>

        <PageContent>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <Card className='space-y-4'>
              {titleAndTypeFields}
              {externalUrlField}
              {descriptionAndGenresFields}
            </Card>

            <Card className='space-y-4'>
              {recommendationAndRatingFields}
            </Card>

            <Button type='submit' size='lg' disabled={loading} className='w-full'>
              {submitLabel}
            </Button>
          </form>
        </PageContent>
      </div>
    )
  }

  // A roomless title shows up in the No rooms yet view, so link there.
  const browseHref = roomId === 'all-rooms'
    ? '/browse?roomId=all-rooms'
    : addsToNoRoom
    ? (roomId === 'no-rooms' ? '/browse?roomId=no-rooms' : '/browse')
    : `/browse?roomId=${roomId}`
  const addedDestination = roomId === 'all-rooms'
    ? 'all your rooms'
    : addsToNoRoom
    ? 'your stuff'
    : selectedRoomName

  // Until the first search, the tab is one centered search box so it can't be
  // mistaken for Browse. Once there's a search, the box docks into the header
  // above the results and stays there until "New search".
  const hasSearched = loading || Boolean(lastSearchedQuery) || searchResults.length > 0
  const showNoResults = !loading && Boolean(lastSearchedQuery) && searchResults.length === 0

  const resetSearch = () => {
    setSearchQuery('')
    setSearchResults([])
    setLastSearchedQuery('')
    setLastAddedTitle(null)
    searchScrollYRef.current = 0
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  const renderSearchField = (size: 'hero' | 'compact') => (
    <form
      role='search'
      onSubmit={(e) => {
        e.preventDefault()
        handleSearch()
      }}
      className='relative w-full'
    >
      <Search
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground',
          size === 'hero' ? 'left-4 h-5 w-5' : 'left-3.5 h-4 w-4',
        )}
        aria-hidden
      />
      <Input
        ref={searchInputRef}
        type='text'
        enterKeyHint='search'
        placeholder='Search movies and shows...'
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className={size === 'hero'
          ? 'h-14 rounded-2xl pl-12 pr-16 shadow-card sm:text-base'
          : 'pl-10 pr-12'}
        aria-label='Search for a title'
      />
      <Button
        type='submit'
        size='icon'
        disabled={loading || !searchQuery.trim()}
        aria-label='Search'
        className={cn(
          'absolute top-1/2 -translate-y-1/2',
          size === 'hero' ? 'right-2 h-10 w-10 rounded-xl' : 'right-1.5 h-8 w-8 rounded-md',
        )}
      >
        <ArrowRight className={size === 'hero' ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden />
      </Button>
    </form>
  )

  const addedNotice = lastAddedTitle && (
    <Notice variant='success' className='text-left'>
      Added <span className='font-semibold'>{lastAddedTitle}</span>
      {addedDestination ? ` to ${addedDestination}` : ''}.{' '}
      <Link
        href={browseHref}
        className='font-medium text-primary underline-offset-4 hover:underline'
      >
        View in Browse
      </Link>
    </Notice>
  )

  const addManuallyButton = (
    <button
      type='button'
      onClick={openManual}
      className='min-h-[36px] text-sm font-medium text-primary underline-offset-4 hover:underline'
    >
      Or add manually
    </button>
  )

  if (!hasSearched) {
    return (
      <div className={pageContainerClassName}>
        <div className='safe-top tab-viewport-height flex flex-col items-center justify-center px-4 pb-[6vh]'>
          <div className='w-full max-w-lg text-center'>
            <BrandVideo className='mx-auto aspect-[16/10] w-44 sm:w-52' />
            <h1 className='mt-1 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl'>
              Add something to watch
            </h1>
            <div className='mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground'>
              <span>Adding to</span>
              <RoomSelector menuAlign='center' />
              {!isVirtualRoomId(roomId) && <RoomMembersAvatars size='sm' />}
            </div>

            {addedNotice && <div className='mt-6'>{addedNotice}</div>}

            <div className='mt-6'>{renderSearchField('hero')}</div>
            <div className='mt-2'>{addManuallyButton}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={pageContainerClassName}>
      <PageHeaderBar>
        <div className='flex items-center gap-1'>
          <BackButton onClick={resetSearch} label='New search' />
          <div className='min-w-0 flex-1'>{renderSearchField('compact')}</div>
        </div>
        <div className='mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1'>
          <div className='flex min-w-0 items-center gap-2 text-sm text-muted-foreground'>
            <span className='whitespace-nowrap'>Adding to</span>
            <RoomSelector />
          </div>
          {addManuallyButton}
        </div>
      </PageHeaderBar>

      <PageContent className='space-y-4'>
        {addedNotice}
        {loading && searchQuery && (
          <div className='space-y-4'>
            <InlineLoading label='Searching' className='py-2' />
            <MediaCardSkeletonList count={3} rooms={false} />
          </div>
        )}

        {showNoResults && (
          <EmptyState
            icon={SearchX}
            title='No results found'
            description="Can't find what you're looking for?"
            action={
              <Button onClick={openManual}>
                Add &quot;{searchQuery}&quot; manually
              </Button>
            }
          />
        )}

        {searchResults.length > 0 && (
          searchResults.map((result, index) => {
            const previous = index > 0 ? searchResults[index - 1] : null
            const via = result.source === 'person' ? result.via : undefined
            const startsPersonGroup = Boolean(
              via && previous &&
                (previous.source !== 'person' || previous.via?.personId !== via.personId),
            )
            return (
              <Fragment key={`${result.type}-${result.id}`}>
                {startsPersonGroup && via && (
                  <div
                    className='flex items-center gap-3 pt-2 text-xs text-muted-foreground'
                    role='separator'
                    aria-label={`More from ${via.name}`}
                  >
                    <span className='h-px flex-1 bg-border' />
                    <span className='inline-flex items-center gap-1 whitespace-nowrap'>
                      <DuotoneIcon icon={User} size={12} />
                      More from {via.name}
                    </span>
                    <span className='h-px flex-1 bg-border' />
                  </div>
                )}
                <MediaCard
                  onClick={() => handleSelectResult(result)}
                  variant='clickable'
                >
                  <CardLayout>
                    {result.posterPath && (
                      <CardPoster
                        src={`https://image.tmdb.org/t/p/w92${result.posterPath}`}
                        alt={result.title}
                        width={80}
                        height={120}
                      />
                    )}
                    <CardContent>
                      <CardTitle className='text-lg'>{result.title}</CardTitle>
                      <CardMeta
                        icon={getTypeIcon(result.type)}
                        type={result.type}
                        releaseDate={result.releaseDate}
                      />
                      {addedResultKeys.has(`${result.type}-${result.id}`) && (
                        <Badge variant='primary' className='mb-1.5 mr-1.5' data-testid='added'>
                          <Check className='h-3 w-3' strokeWidth={3} aria-hidden />
                          Added
                        </Badge>
                      )}
                      {via && (
                        <Badge variant='muted' className='mb-1.5' data-testid='person-source'>
                          <DuotoneIcon icon={User} size={12} />
                          {getViaLabel(via)}
                        </Badge>
                      )}
                      {result.genreIds && result.genreIds.length > 0 && (
                        <CardGenres
                          genres={getGenreNames(result.genreIds, result.type)}
                          maxDisplay={3}
                        />
                      )}
                      {result.overview && (
                        <CardDescription lineClamp={2} className='mt-2'>
                          {result.overview}
                        </CardDescription>
                      )}
                    </CardContent>
                  </CardLayout>
                </MediaCard>
              </Fragment>
            )
          })
        )}
      </PageContent>
    </div>
  )
}
