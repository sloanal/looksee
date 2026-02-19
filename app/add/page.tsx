'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Film, Tv, Video, Link as LinkIcon, Calendar, ArrowLeft } from 'lucide-react'
import { RoomSelector } from '@/components/RoomSelector'
import { RoomMembersAvatars } from '@/components/RoomMembersAvatars'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import {
  MediaCard,
  CardLayout,
  CardPoster,
  CardMenu,
  CardContent,
  CardTitle,
  CardSubtitle,
  CardDescription,
  CardGenres,
} from '@/components/MediaCard'
import { getGenreNames } from '@/lib/tmdb-genres'

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

interface TMDBResult {
  id: number
  title: string
  releaseDate?: string
  posterPath?: string
  type: 'movie' | 'show'
  overview?: string
  genreIds?: number[]
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

  const [mode, setMode] = useState<'search' | 'manual' | 'confirm'>('search')
  const searchParam = searchParams.get('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([])
  const [selectedResult, setSelectedResult] = useState<TMDBDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasAutoSearched, setHasAutoSearched] = useState(false)
  const [lastSearchedQuery, setLastSearchedQuery] = useState<string>('')

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
    setLastSearchedQuery(searchQuery.trim())
    try {
      const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(searchQuery)}&type=mixed`)
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Error: ${res.status} ${res.statusText}` }))
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
    if (searchParam && !hasAutoSearched && sessionStatus === 'authenticated' && session && searchQuery.trim()) {
      setHasAutoSearched(true)
      handleSearch()
    }
  }, [searchParam, hasAutoSearched, session, sessionStatus, searchQuery, handleSearch])

  const handleSelectResult = async (result: TMDBResult) => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/tmdb/details?id=${result.id}&type=${result.type === 'movie' ? 'movie' : 'tv'}`
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
      }

      // If "all-rooms" is selected, add to all rooms
      if (roomId === 'all-rooms') {
        const res = await fetch('/api/rooms/all-rooms/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          router.push(`/browse?roomId=all-rooms`)
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
      } else if (!roomId) {
        // "Just My Stuff" - create item without adding it to any room
        const res = await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          router.push(`/browse`)
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
          router.push(`/browse?roomId=${roomId}`)
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

  if (mode === 'confirm') {
    return (
      <div className="max-w-4xl xl:max-w-5xl mx-auto">
        <div className="sticky top-0 z-10">
          <div className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 bg-background border-b border-border pointer-events-none" />
          <div className="relative max-w-4xl xl:max-w-5xl mx-auto p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setMode('search')
                    setSelectedResult(null)
                    setIsConfirmMenuOpen(false)
                  }}
                  className="flex items-center justify-center p-1.5 -ml-1 rounded-md hover:bg-accent transition-colors"
                  aria-label="Back"
                >
                  <DuotoneIcon icon={ArrowLeft} size={20} />
                </button>
                <h1 className="text-2xl font-bold text-foreground whitespace-nowrap leading-tight">Confirm</h1>
                <RoomSelector />
              </div>
            </div>
          </div>
        </div>

        <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] lg:w-full lg:left-0 lg:right-0 lg:ml-0 lg:mr-0">
          <div className="bg-content p-4 min-h-[calc(100vh-200px)]">
            <form onSubmit={handleSubmit} className="space-y-4 max-w-4xl mx-auto">
          <MediaCard className="relative">
            <div ref={confirmMenuRef}>
              <CardMenu>
                <button
                  type="button"
                  onClick={() => setIsConfirmMenuOpen((prev) => !prev)}
                  className="p-2 text-muted-foreground opacity-60 hover:text-foreground hover:opacity-100 hover:bg-accent rounded-full transition-colors"
                  aria-label="Menu"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </button>
                {isConfirmMenuOpen && (
                  <div className="absolute right-0 mt-1 w-44 bg-popover rounded-md shadow-lg border border-border py-1 z-[20]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsConfirmDetailsEditable((prev) => !prev)
                        setIsConfirmMenuOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-accent"
                    >
                      {isConfirmDetailsEditable ? 'Lock details' : 'Edit details'}
                    </button>
                  </div>
                )}
              </CardMenu>
            </div>

            {isConfirmDetailsEditable ? (
              <div className="space-y-4 pr-10">
                <div>
                  <label className="block text-sm font-medium mb-1">Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Type *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground"
                  >
                    <option value="movie">Movie</option>
                    <option value="show">Show</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            ) : (
              <>
                <input type="text" value={title} readOnly required className="hidden" aria-hidden />
                <CardLayout>
                  <CardPoster src={selectedResult?.posterUrl || null} alt={title || 'Selected title'} width={80} height={120} />
                  <CardContent>
                    <CardTitle className="text-xl">{title || 'Untitled'}</CardTitle>
                    <div className="flex items-center gap-1 mb-1">
                      <DuotoneIcon icon={getTypeIcon(type)} size={12} />
                      <CardSubtitle className="mb-0">{type}</CardSubtitle>
                      {selectedResult?.releaseDate && (
                        <>
                          <DuotoneIcon icon={Calendar} size={12} />
                          <p className="text-xs text-muted-foreground mb-0">
                            {new Date(selectedResult.releaseDate).getFullYear()}
                          </p>
                        </>
                      )}
                    </div>
                    {parsedGenres.length > 0 && <CardGenres genres={parsedGenres} maxDisplay={8} />}
                    {description ? (
                      <CardDescription lineClamp={0} className="mt-2 mb-0">{description}</CardDescription>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-2 mb-0">No description yet</p>
                    )}
                  </CardContent>
                </CardLayout>
              </>
            )}
          </MediaCard>

          {!selectedResult && (
            <div>
              <label className="block text-sm font-medium mb-1">External URL (optional)</label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="https://..."
              />
            </div>
          )}

          {isConfirmDetailsEditable && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Genres (comma-separated)</label>
                <input
                  type="text"
                  value={genres}
                  onChange={(e) => setGenres(e.target.value)}
                  className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Recommended by</label>
            <input
              type="text"
              value={recommendedByName}
              onChange={(e) => setRecommendedByName(e.target.value)}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Recommendation notes</label>
            <textarea
              value={recommendationContext}
              onChange={(e) => setRecommendationContext(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Why was this recommended?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">My Status *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground"
            >
              <option value="have_not_seen">Have not seen</option>
              <option value="already_seen">Already seen</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              My Excitement *
            </label>
            <select
              value={excitement}
              onChange={(e) => setExcitement(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground"
            >
              <option value={1}>Not excited</option>
              <option value={3}>Neutral</option>
              <option value={5}>Excited</option>
            </select>
          </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? 'Adding...' : roomId === 'all-rooms' ? 'Add to All Rooms' : !roomId ? 'Add to My Stuff' : 'Add to Room'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'manual') {
    return (
      <div className="max-w-4xl xl:max-w-5xl mx-auto">
        <div className="sticky top-0 z-10">
          <div className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 bg-background border-b border-border pointer-events-none" />
          <div className="relative max-w-4xl xl:max-w-5xl mx-auto p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-4">
                <button onClick={() => setMode('search')} className="text-primary">
                  ← Back to Search
                </button>
                <h1 className="text-2xl font-bold text-foreground">Add Manually</h1>
              </div>
              <RoomSelector />
            </div>
          </div>
        </div>

        <div className="p-4">

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground"
            >
              <option value="movie">Movie</option>
              <option value="show">Show</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">External URL (optional)</label>
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Genres (comma-separated)</label>
            <input
              type="text"
              value={genres}
              onChange={(e) => setGenres(e.target.value)}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Recommended by</label>
            <input
              type="text"
              value={recommendedByName}
              onChange={(e) => setRecommendedByName(e.target.value)}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Recommendation notes</label>
            <textarea
              value={recommendationContext}
              onChange={(e) => setRecommendationContext(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">My Status *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground"
            >
              <option value="have_not_seen">Have not seen</option>
              <option value="already_seen">Already seen</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              My Excitement *
            </label>
            <select
              value={excitement}
              onChange={(e) => setExcitement(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground"
            >
              <option value={1}>Not excited</option>
              <option value={3}>Neutral</option>
              <option value={5}>Excited</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Adding...' : roomId === 'all-rooms' ? 'Add to All Rooms' : !roomId ? 'Add to My Stuff' : 'Add to Room'}
          </button>
        </form>
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
              <h1 className="text-2xl font-bold text-foreground">Add to</h1>
              <RoomSelector />
            </div>
            <RoomMembersAvatars />
          </div>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search for a new title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-6 h-10 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center"
              >
                Search
              </button>
            </div>
            <button
              onClick={() => {
                if (searchQuery) setTitle(searchQuery)
                setMode('manual')
              }}
              className="text-sm text-primary hover:underline"
            >
              Or add manually
            </button>
          </div>
        </div>
      </div>

      <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] lg:w-full lg:left-0 lg:right-0 lg:ml-0 lg:mr-0">
        <div className="space-y-4 bg-content p-4 min-h-[calc(100vh-200px)]">
      {!loading && searchResults.length === 0 && !(lastSearchedQuery && searchQuery.trim() === lastSearchedQuery) && (
        <div className="flex items-center justify-center min-h-[calc(100vh-280px)]">
          <div className="w-full max-w-md overflow-hidden rounded-xl text-center aspect-[16/9]">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover object-center"
            >
              <source src="/welcome.mp4" type="video/mp4" />
            </video>
            <button
              type="button"
              onClick={() => searchInputRef.current?.focus()}
              className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Add something you want to watch
            </button>
          </div>
        </div>
      )}
      {loading && searchQuery && (
        <div className="text-center text-muted-foreground py-8">Searching...</div>
      )}

      {!loading && lastSearchedQuery && searchQuery.trim() === lastSearchedQuery && searchResults.length === 0 && (
        <div className="text-center text-muted-foreground py-8 space-y-4">
          <div>No results found</div>
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm">Can&apos;t find what you&apos;re looking for?</p>
            <Button
              onClick={() => {
                if (searchQuery) setTitle(searchQuery)
                setMode('manual')
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Add &quot;{searchQuery}&quot; manually
            </Button>
          </div>
        </div>
      )}

      {searchResults.length > 0 && (
          searchResults.map((result) => (
            <MediaCard
              key={`${result.type}-${result.id}`}
              onClick={() => handleSelectResult(result)}
              variant="clickable"
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
                  <CardTitle className="text-lg">{result.title}</CardTitle>
                  <div className="flex items-center gap-1 mb-0.5">
                    <DuotoneIcon icon={getTypeIcon(result.type)} size={12} />
                    <CardSubtitle className="mb-0">{result.type}</CardSubtitle>
                    {result.releaseDate && (
                      <>
                        <DuotoneIcon icon={Calendar} size={12} />
                        <p className="text-xs text-muted-foreground mb-0">
                          {new Date(result.releaseDate).getFullYear()}
                        </p>
                      </>
                    )}
                  </div>
                  {result.genreIds && result.genreIds.length > 0 && (
                    <CardGenres
                      genres={getGenreNames(result.genreIds, result.type)}
                      maxDisplay={3}
                    />
                  )}
                  {result.overview && (
                    <CardDescription lineClamp={2} className="mt-2">{result.overview}</CardDescription>
                  )}
                </CardContent>
              </CardLayout>
            </MediaCard>
          ))
      )}
        </div>
      </div>
    </div>
  )
}

