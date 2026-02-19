'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, EyeOff, Film, Tv, Video, Link as LinkIcon, Calendar, Star, Edit, Sofa, Frown, Meh, Smile, Plus } from 'lucide-react'
import { RoomSelector } from '@/components/RoomSelector'
import { RoomMembersAvatars } from '@/components/RoomMembersAvatars'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import { useModalAnimation } from '@/lib/useModalAnimation'
import { getAvatarColor } from '@/lib/utils'
import {
  MediaCard,
  CardLayout,
  CardPoster,
  CardContent,
  CardTitle,
  CardSubtitle,
  CardDescription,
  CardGenres,
  CardMenu,
  CardHeader,
} from '@/components/MediaCard'
import { EditRoomsModal } from '@/components/EditRoomsModal'

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

interface MediaItem {
  id: string
  title: string
  type: string
  sourceType?: string
  posterUrl?: string
  description?: string
  genres: string[]
  externalUrl?: string
  runtimeMinutes?: number
  releaseDate?: string
  rating?: number
  tmdbId?: string | null
  myPreference?: {
    status: string
    isWatched?: boolean
    excitement: number
    notes?: string
    recommendedByName?: string
    recommendationContext?: string
  }
  otherPreferences?: Array<{
    status: string
    excitement: number
    user: {
      id: string
      name: string
      imageUrl?: string | null
    }
  }>
  createdBy: string
  createdByUserId?: string
  rooms?: Array<{
    id: string
    name: string
    addedByUserId: string
    addedByName: string
  }>
}

export default function BrowsePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')
  const isWatchedView = roomId === 'watched'

  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [myStatusFilter, setMyStatusFilter] = useState('unrated')
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [myAvatar, setMyAvatar] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState(false)
  const [failedUserImages, setFailedUserImages] = useState<Set<string>>(new Set())
  const [tooltipItemId, setTooltipItemId] = useState<string | null>(null)
  const [tooltipTimeout, setTooltipTimeout] = useState<NodeJS.Timeout | null>(null)
  const [detailModalItem, setDetailModalItem] = useState<MediaItem | null>(null)
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null)
  const [loadingTrailer, setLoadingTrailer] = useState(false)
  const [editingRoomsItem, setEditingRoomsItem] = useState<MediaItem | null>(null)
  const [markingWatchedItemId, setMarkingWatchedItemId] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (myStatusFilter !== 'unrated') params.set('myStatus', myStatusFilter)

    try {
      let url: string
      if (roomId === 'watched') {
        params.set('watched', 'true')
        url = `/api/media?${params}`
      } else if (roomId === 'all-rooms') {
        params.set('allRooms', 'true')
        url = `/api/media?${params}`
      } else if (roomId) {
        url = `/api/rooms/${roomId}/media?${params}`
      } else {
        url = `/api/media?${params}`
      }
      const res = await fetch(url)
      if (!res.ok) {
        console.error('API error:', res.status, res.statusText)
        const errorData = await res.json().catch(() => ({}))
        console.error('Error data:', errorData)
        return
      }
      const data = await res.json()
      if (data.items) {
        setItems(data.items)
      } else {
        console.error('No items in response:', data)
        setItems([])
      }
    } catch (err) {
      console.error('Failed to load items:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [roomId, debouncedSearch, typeFilter, myStatusFilter])

  const loadMyAvatar = async () => {
    try {
      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const data = await res.json()
        setMyAvatar(data.user?.imageUrl || null)
        setAvatarError(false) // Reset error when avatar changes
      }
    } catch (err) {
      console.error('Failed to load avatar:', err)
    }
  }

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)

    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    loadItems()
    loadMyAvatar()
  }, [session, status, loadItems, router])

  // Restore scroll position after items load
  useEffect(() => {
    if (!loading && items.length > 0) {
      const savedScrollPosition = sessionStorage.getItem('browseScrollPosition')
      if (savedScrollPosition) {
        const position = parseInt(savedScrollPosition, 10)
        // Use double requestAnimationFrame for Safari compatibility
        // Safari needs more time for DOM to be fully rendered
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Try multiple methods for Safari compatibility
            window.scrollTo({
              top: position,
              behavior: 'instant' as ScrollBehavior
            })
            // Fallback for older Safari versions
            if (window.scrollY !== position && document.documentElement) {
              document.documentElement.scrollTop = position
            }
            if (document.body && document.body.scrollTop !== position) {
              document.body.scrollTop = position
            }
            sessionStorage.removeItem('browseScrollPosition')
          })
        })
      }
    }
  }, [loading, items.length])

  // Handle clicks outside menu
  useEffect(() => {
    if (!openMenuId) {
      // Clear tooltip when menu closes
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout)
        setTooltipTimeout(null)
      }
      setTooltipItemId(null)
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      // Don't close if clicking inside menu container or on menu toggle button
      if (target.closest('[data-menu-container]')) {
        return
      }
      setOpenMenuId(null)
    }

    // Add listener after current event loop to allow button clicks to process
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId, tooltipTimeout])

  // Cleanup tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout)
      }
    }
  }, [tooltipTimeout])

  const getStatusLabel = (status?: string) => {
    if (!status) return 'Unrated'
    const normalizedStatus = status.toLowerCase()
    const labels: Record<string, string> = {
      have_not_seen: 'Have not seen',
      already_seen: 'Already seen',
      // Handle old status values that might still exist
      not_seen_want: 'Have not seen',
      not_seen_dont_want: 'Have not seen',
      seen_would_rewatch: 'Already seen',
      seen_wont_rewatch: 'Already seen',
    }
    return labels[normalizedStatus] || 'Unrated'
  }

  const getExcitementLabel = (excitement?: number) => {
    if (!excitement || (excitement !== 1 && excitement !== 3 && excitement !== 5)) return ''
    const labels: Record<number, string> = {
      1: 'Not excited',
      3: 'Neutral',
      5: 'Excited',
    }
    return labels[excitement] || ''
  }

  const handleDelete = async (item: MediaItem) => {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/media/${item.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setOpenMenuId(null)
        loadItems()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete item')
      }
    } catch (err) {
      console.error('Failed to delete:', err)
      alert('Failed to delete item')
    }
  }

  const handleDeleteHover = (itemId: string, canDelete: boolean) => {
    if (!canDelete) {
      // Clear any existing timeout
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout)
      }
      // Set a new timeout to show tooltip after 500ms
      const timeout = setTimeout(() => {
        setTooltipItemId(itemId)
      }, 500)
      setTooltipTimeout(timeout)
    } else {
      // Clear timeout and hide tooltip if user can delete
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout)
        setTooltipTimeout(null)
      }
      setTooltipItemId(null)
    }
  }

  const handleDeleteLeave = () => {
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout)
      setTooltipTimeout(null)
    }
    setTooltipItemId(null)
  }

  async function loadTrailer(item: MediaItem) {
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

  const handleMarkAsWatched = async (itemId: string) => {
    setMarkingWatchedItemId(itemId)
    try {
      const res = await fetch(`/api/media/${itemId}/watched`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to mark title as watched')
        return
      }
      setOpenMenuId(null)
      await loadItems()
    } catch (err) {
      console.error('Failed to mark as watched:', err)
      alert('Failed to mark title as watched')
    } finally {
      setMarkingWatchedItemId(null)
    }
  }

  const handleRemoveFromWatched = async (itemId: string) => {
    setMarkingWatchedItemId(itemId)
    try {
      const res = await fetch(`/api/media/${itemId}/watched`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to remove title from watched')
        return
      }
      setOpenMenuId(null)
      await loadItems()
    } catch (err) {
      console.error('Failed to remove from watched:', err)
      alert('Failed to remove title from watched')
    } finally {
      setMarkingWatchedItemId(null)
    }
  }

  return (
    <div className="max-w-4xl xl:max-w-5xl mx-auto">
      <div className="sticky top-0 z-10">
        <div className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 bg-background border-b border-border pointer-events-none" />
        <div className="relative max-w-4xl xl:max-w-5xl mx-auto p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">Browse</h1>
              <RoomSelector />
            </div>
            <RoomMembersAvatars />
          </div>

          <div className="space-y-3">
            <Input
              type="text"
              placeholder="Search your titles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />

            <div className="flex gap-2 flex-wrap">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-input rounded-md text-sm text-foreground bg-background"
              >
                <option value="all">All Types</option>
                <option value="movie">Movies</option>
                <option value="show">Shows</option>
                <option value="video">Videos</option>
                <option value="link">Links</option>
              </select>

              <select
                value={myStatusFilter}
                onChange={(e) => setMyStatusFilter(e.target.value)}
                className="px-3 py-2 border border-input rounded-md text-sm text-foreground bg-background"
              >
                <option value="unrated">All Items</option>
                <option value="have_not_seen">Have not seen</option>
                <option value="already_seen">Already seen</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] lg:w-full lg:left-0 lg:right-0 lg:ml-0 lg:mr-0">
        <div ref={scrollContainerRef} className="p-4 space-y-4 bg-content min-h-[calc(100vh-200px)]">
      {loading ? (
        <div className="text-center text-muted-foreground py-8">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 space-y-4">
          <div>No saved items found</div>
          {debouncedSearch && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm">Can&apos;t find what you&apos;re looking for?</p>
              <Button
                onClick={() => {
                  const params = new URLSearchParams()
                  if (roomId) params.set('roomId', roomId)
                  params.set('search', debouncedSearch)
                  router.push(`/add?${params.toString()}`)
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Search for &quot;{debouncedSearch}&quot; and add
              </Button>
            </div>
          )}
        </div>
      ) : (
          items.map((item) => (
            <MediaCard key={item.id} variant="default" className="relative">
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingRoomsItem(item)
                }}
                className="flex items-center justify-between -mx-4 -mt-4 px-4 pt-3 pb-2 mb-2 border-b border-border bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors relative"
              >
                <div className="flex items-center gap-2 flex-wrap flex-1 pr-8">
                  <DuotoneIcon icon={Sofa} size={14} />
                  {item.rooms && item.rooms.length > 0 ? (
                    item.rooms.map((room) => (
                      <span
                        key={room.id}
                        className="px-2 py-0.5 bg-foreground/10 text-foreground text-xs rounded"
                      >
                        {room.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      No rooms yet
                    </span>
                  )}
                </div>
                <div className="absolute right-[16px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-muted-foreground flex items-center justify-center text-muted-foreground opacity-60 pointer-events-none" style={{ borderWidth: '1.5px' }}>
                  <Plus size={8} strokeWidth={3.5} />
                </div>
              </div>
              <CardMenu className="!top-12">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(openMenuId === item.id ? null : item.id)
                  }}
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
                {openMenuId === item.id && (
                  <div className="absolute right-0 mt-1 w-44 bg-popover rounded-md shadow-lg border border-border py-1 z-[9]">
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (isWatchedView) {
                          handleRemoveFromWatched(item.id)
                        } else {
                          handleMarkAsWatched(item.id)
                        }
                      }}
                      variant="ghost"
                      size="sm"
                      disabled={markingWatchedItemId === item.id}
                      className="w-full justify-start px-4"
                    >
                      {isWatchedView ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                      {markingWatchedItemId === item.id
                        ? 'Saving...'
                        : isWatchedView
                        ? 'Mark unwatched'
                        : 'Mark as watched'}
                    </Button>
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setOpenMenuId(null)
                        setEditingItem(item)
                      }}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start px-4"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Edit details
                    </Button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const canDelete = item.createdByUserId === session?.user?.id
                          if (canDelete) {
                            setOpenMenuId(null)
                            handleDelete(item)
                          }
                        }}
                        onMouseEnter={() => handleDeleteHover(item.id, item.createdByUserId === session?.user?.id)}
                        onMouseLeave={handleDeleteLeave}
                        disabled={item.createdByUserId !== session?.user?.id}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                          item.createdByUserId === session?.user?.id
                            ? 'text-destructive hover:bg-accent'
                            : 'text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                        Delete
                      </button>
                      {tooltipItemId === item.id && item.createdByUserId !== session?.user?.id && (
                        <div className="absolute bottom-full left-0 mb-2 z-50 bg-foreground text-background text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                          You can only delete items you created
                          <div className="absolute top-full left-4 border-4 border-transparent border-t-foreground"></div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardMenu>
              <CardLayout>
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    setDetailModalItem(item)
                    loadTrailer(item)
                  }}
                  className="cursor-pointer pt-2"
                >
                  <CardPoster src={item.posterUrl} alt={item.title} width={80} height={120} />
                </div>
                <CardContent className="pr-0 py-2">
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      setDetailModalItem(item)
                      loadTrailer(item)
                    }}
                    className="cursor-pointer"
                  >
                    <CardTitle>{item.title}</CardTitle>
                    {item.myPreference?.isWatched && (
                      <div className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground mb-1">
                        <EyeOff className="w-3 h-3" />
                        Watched
                      </div>
                    )}
                    <div className="flex items-center gap-1 mb-0.5">
                      <DuotoneIcon icon={getTypeIcon(item.type)} size={12} />
                      <CardSubtitle className="mb-0">{item.type}</CardSubtitle>
                      {item.releaseDate && (
                        <>
                          <DuotoneIcon icon={Calendar} size={12} />
                          <p className="text-xs text-muted-foreground mb-0">
                            {new Date(item.releaseDate).getFullYear()}
                          </p>
                        </>
                      )}
                    </div>
                    <CardGenres genres={item.genres} maxDisplay={3} />
                    {item.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </CardLayout>
              <div className="space-y-0.5 -mx-4 -mb-4 px-4 pt-1 pb-1 border-t border-border mt-2 bg-muted/50">
                {item.myPreference ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedItem(item)
                    }}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/70 transition-colors -mx-4 px-4 py-0.5 rounded"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {myAvatar && !avatarError ? (
                        <div className="w-6 h-6 flex-shrink-0">
                          <Image
                            src={myAvatar}
                            alt={session?.user?.name || 'You'}
                            width={24}
                            height={24}
                            className="rounded-full object-cover w-full h-full"
                            unoptimized
                            onError={() => setAvatarError(true)}
                          />
                        </div>
                      ) : (
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 text-white font-medium"
                          style={{ backgroundColor: getAvatarColor(session?.user?.id || session?.user?.name || 'user') }}
                        >
                          {(session?.user?.name?.[0] || '?').toUpperCase()}
                        </div>
                      )}
                      <span className="text-foreground flex items-center gap-2">
                        <DuotoneIcon 
                          icon={item.myPreference.excitement === 1 ? Frown : item.myPreference.excitement === 3 ? Meh : Smile} 
                          size={18} 
                          active
                          strokeWidth={1.5}
                        />
                        {(() => {
                          const excitementText = getExcitementLabel(item.myPreference.excitement)
                          return excitementText ? `${excitementText}, ` : null
                        })()}
                        {getStatusLabel(item.myPreference.status)}
                      </span>
                    </div>
                    <DuotoneIcon icon={Edit} size={14} />
                  </div>
                ) : null}
                {item.otherPreferences && item.otherPreferences.length > 0 && (
                  <>
                    {item.otherPreferences.map((pref) => (
                      <div
                        key={pref.user.id}
                        className="flex items-center gap-2 text-sm -mx-4 px-4 py-0.5"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          {pref.user.imageUrl && !failedUserImages.has(pref.user.imageUrl) ? (
                            <div className="w-6 h-6 flex-shrink-0">
                              <Image
                                src={pref.user.imageUrl}
                                alt={pref.user.name}
                                width={24}
                                height={24}
                                className="rounded-full object-cover w-full h-full"
                                unoptimized
                                onError={() => {
                                  const imageUrl = pref.user.imageUrl
                                  if (imageUrl) {
                                    setFailedUserImages((prev) => new Set(prev).add(imageUrl))
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div 
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 text-white font-medium"
                              style={{ backgroundColor: getAvatarColor(pref.user.id || pref.user.name) }}
                            >
                              {(pref.user.name[0] || '?').toUpperCase()}
                            </div>
                          )}
                          <span className="text-foreground flex items-center gap-2">
                            <DuotoneIcon 
                              icon={pref.excitement === 1 ? Frown : pref.excitement === 3 ? Meh : Smile} 
                              size={18} 
                              active
                              strokeWidth={1.5}
                            />
                            {(() => {
                              const excitementText = getExcitementLabel(pref.excitement)
                              return excitementText ? `${excitementText}, ` : null
                            })()}
                            {getStatusLabel(pref.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {!item.myPreference && (
                  <div className="flex justify-center pt-1 pb-2">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedItem(item)
                      }}
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                    >
                      Add your excitement
                    </Button>
                  </div>
                )}
              </div>
            </MediaCard>
          ))
      )}
        </div>
      </div>

      {selectedItem && (
        <ItemDetailModal 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)} 
          roomId={roomId}
          onSave={() => {
            // Save scroll position before reload - use multiple methods for Safari compatibility
            const scrollPosition = window.scrollY || 
                                  document.documentElement.scrollTop || 
                                  document.body.scrollTop || 
                                  0
            sessionStorage.setItem('browseScrollPosition', scrollPosition.toString())
            loadItems()
          }}
        />
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={() => {
            setEditingItem(null)
            loadItems()
          }}
        />
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

      {editingRoomsItem && (
        <EditRoomsModal
          mediaItemId={editingRoomsItem.id}
          currentRooms={editingRoomsItem.rooms || []}
          onClose={() => setEditingRoomsItem(null)}
          onSave={() => {
            setEditingRoomsItem(null)
            loadItems()
          }}
        />
      )}
    </div>
  )
}

function ItemDetailModal({
  item,
  onClose,
  roomId,
  onSave,
}: {
  item: MediaItem
  onClose: () => void
  roomId: string | null
  onSave?: () => void
}) {
  const [status, setStatus] = useState(item.myPreference?.status || 'have_not_seen')
  const [excitement, setExcitement] = useState(item.myPreference?.excitement || 3)
  const [saving, setSaving] = useState(false)
  const { isClosing, handleClose } = useModalAnimation(onClose)

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/media/${item.id}/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, excitement }),
      })
      handleClose()
      if (onSave) {
        onSave()
      } else {
        window.location.reload()
      }
    } catch (err) {
      console.error('Failed to save preference:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div 
        className={`bg-card rounded-lg max-w-md w-full modal-content relative ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-10 text-muted-foreground text-2xl hover:text-foreground"
        >
          ×
        </button>
        <div className="p-6">
          <div className="mb-4 pr-8">
            <h2 className="text-2xl font-bold text-foreground">{item.title}</h2>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Your status</label>
            <div className="space-y-2">
              {[
                { value: 'have_not_seen', label: 'Have not seen' },
                { value: 'already_seen', label: 'Already seen' },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value={opt.value}
                    checked={status === opt.value}
                    onChange={(e) => setStatus(e.target.value)}
                    className="mr-2"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Your excitement
            </label>
            <div className="space-y-2">
              {[
                { value: 1, label: 'Not excited', icon: Frown },
                { value: 3, label: 'Neutral', icon: Meh },
                { value: 5, label: 'Excited', icon: Smile },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center">
                  <input
                    type="radio"
                    name="excitement"
                    value={opt.value}
                    checked={excitement === opt.value}
                    onChange={(e) => setExcitement(parseInt(e.target.value))}
                    className="mr-2"
                  />
                  <opt.icon className="w-4 h-4 mr-2" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function EditItemModal({
  item,
  onClose,
  onSave,
}: {
  item: MediaItem
  onClose: () => void
  onSave: () => void
}) {
  const isManual = item.sourceType?.toLowerCase() === 'manual'
  const [saving, setSaving] = useState(false)
  const { isClosing, handleClose } = useModalAnimation(onClose)

  // For manual items
  const [title, setTitle] = useState(item.title)
  const [type, setType] = useState(item.type)
  const [description, setDescription] = useState(item.description || '')
  const [genres, setGenres] = useState(item.genres.join(', '))
  const [posterUrl, setPosterUrl] = useState(item.posterUrl || '')
  const [externalUrl, setExternalUrl] = useState(item.externalUrl || '')
  const [runtimeMinutes, setRuntimeMinutes] = useState(item.runtimeMinutes?.toString() || '')

  // For preference fields (both manual and TMDB)
  const [notes, setNotes] = useState(item.myPreference?.notes || '')
  const [recommendedByName, setRecommendedByName] = useState(item.myPreference?.recommendedByName || '')
  const [recommendationContext, setRecommendationContext] = useState(
    item.myPreference?.recommendationContext || ''
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isManual) {
        // Update media item
        const genreArray = genres
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean)

        await fetch(`/api/media/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            type,
            description: description || null,
            genres: genreArray,
            posterUrl: posterUrl || null,
            externalUrl: externalUrl || null,
            runtimeMinutes: runtimeMinutes ? parseInt(runtimeMinutes) : null,
          }),
        })
      }

      // Update preference fields (notes, recommendedByName, recommendationContext)
      if (notes !== item.myPreference?.notes ||
          recommendedByName !== item.myPreference?.recommendedByName ||
          recommendationContext !== item.myPreference?.recommendationContext) {
        await fetch(`/api/media/${item.id}/preference`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: notes || null,
            recommendedByName: recommendedByName || null,
            recommendationContext: recommendationContext || null,
          }),
        })
      }

      handleClose()
      onSave()
    } catch (err) {
      console.error('Failed to save:', err)
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-overlay ${isClosing ? 'closing' : ''}`}>
      <div className={`bg-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-content relative ${isClosing ? 'closing' : ''}`}>
        <button 
          onClick={handleClose} 
          className="absolute top-4 right-4 z-10 text-muted-foreground text-2xl hover:text-foreground"
        >
          ×
        </button>
        <div className="p-6">
          <div className="mb-4 pr-8">
            <h2 className="text-2xl font-bold text-foreground">Edit {item.title}</h2>
          </div>

          {isManual ? (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Title *</label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Type *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                >
                  <option value="movie">Movie</option>
                  <option value="show">Show</option>
                  <option value="video">Video</option>
                  <option value="link">Link</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Genres (comma-separated)</label>
                <Input
                  type="text"
                  value={genres}
                  onChange={(e) => setGenres(e.target.value)}
                  placeholder="Action, Drama, Comedy"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Poster URL</label>
                <Input
                  type="url"
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">External URL</label>
                <Input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Runtime (minutes)</label>
                <Input
                  type="number"
                  value={runtimeMinutes}
                  onChange={(e) => setRuntimeMinutes(e.target.value)}
                  placeholder="120"
                />
              </div>
            </>
          ) : (
            <div className="mb-4 p-4 bg-secondary rounded-md">
              <p className="text-sm text-secondary-foreground">
                This item was added via TMDB search. You can only edit recommendation and notes information.
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add your notes about this item..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Recommended By</label>
            <Input
              type="text"
              value={recommendedByName}
              onChange={(e) => setRecommendedByName(e.target.value)}
              placeholder="Name of person who recommended this"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Recommendation Context</label>
            <Textarea
              value={recommendationContext}
              onChange={(e) => setRecommendationContext(e.target.value)}
              rows={2}
              placeholder="Why was this recommended? When? Where?"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailModal({
  item,
  trailerUrl,
  loadingTrailer,
  onClose,
}: {
  item: MediaItem
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

              {item.myPreference?.recommendedByName && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Recommended By</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.myPreference.recommendedByName}
                    {item.myPreference.recommendationContext && (
                      <span className="block mt-1 text-xs italic">
                        {item.myPreference.recommendationContext}
                      </span>
                    )}
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

