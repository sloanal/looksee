'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Eye,
  EyeOff,
  Film,
  Link as LinkIcon,
  Pencil,
  Search,
  SearchX,
  Trash2,
  Tv,
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MenuItem, MenuPanel, MenuTrigger } from '@/components/ui/menu'
import { Modal, ModalBody, ModalFooter, ModalHeader, useModal } from '@/components/ui/modal'
import { Notice } from '@/components/ui/notice'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { notifyRoomsChanged } from '@/lib/rooms'
import {
  CardBand,
  CardContent,
  CardDescription,
  CardGenres,
  CardLayout,
  CardMenu,
  CardMeta,
  CardPoster,
  CardRoomsBand,
  CardTitle,
  MediaCard,
} from '@/components/MediaCard'
import { MediaCardSkeletonList } from '@/components/MediaCardSkeleton'
import { EditRoomsModal } from '@/components/EditRoomsModal'
import { StreamingProviders } from '@/components/StreamingProviders'
import { FavoriteButton } from '@/components/FavoriteButton'
import { SubmissionInfo, SubmissionMeta } from '@/components/SubmissionMeta'
import { DetailSection, isTmdbItem, MediaDetailBody } from '@/components/MediaDetail'
import { RatingFields } from '@/components/RatingFields'
import { RatingLine } from '@/components/RatingLine'
import { matchesAnyToken } from '@/lib/search-normalize'

type SearchMatchField = 'title' | 'recommender' | 'notes' | 'year'

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
    isFavorite?: boolean
    excitement: number
    notes?: string
    recommendedByName?: string
    recommendationContext?: string
  }
  otherPreferences?: Array<{
    status: string
    excitement: number
    isFavorite?: boolean
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
  submission?: SubmissionInfo | null
  matchedOn?: SearchMatchField[]
}

// Why a result appeared when its title did not match the search. Uses the same
// normalization as the server so the hint names the field that actually hit.
function searchMatchHint(item: MediaItem, query: string): string | null {
  const matchedOn = item.matchedOn
  if (!query || !matchedOn || matchedOn.length === 0 || matchedOn.indexOf('title') !== -1) {
    return null
  }
  const hints: string[] = []
  if (matchedOn.indexOf('recommender') !== -1) {
    const mine = item.myPreference?.recommendedByName
    const theirs = item.submission?.recommendedByName
    if (mine && matchesAnyToken(mine, query)) hints.push(`Recommended by ${mine}`)
    else if (theirs && matchesAnyToken(theirs, query)) hints.push(`Recommended by ${theirs}`)
    else hints.push("Matches a housemate's recommender")
  }
  if (matchedOn.indexOf('notes') !== -1) hints.push('In your notes')
  if (matchedOn.indexOf('year') !== -1 && item.releaseDate) {
    hints.push(`Released ${new Date(item.releaseDate).getFullYear()}`)
  }
  return hints.length > 0 ? hints.join(' · ') : null
}

export default function BrowsePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')
  const isWatchedView = roomId === 'watched'
  const selectedRoomName = useSelectedRoomName()

  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [myStatusFilter, setMyStatusFilter] = useState('all')
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [myAvatar, setMyAvatar] = useState<string | null>(null)
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
    if (myStatusFilter !== 'all') params.set('myStatus', myStatusFilter)

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
              behavior: 'instant' as ScrollBehavior,
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
        notifyRoomsChanged()
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
      notifyRoomsChanged()
      await loadItems()
    } catch (err) {
      console.error('Failed to mark as watched:', err)
      alert('Failed to mark title as watched')
    } finally {
      setMarkingWatchedItemId(null)
    }
  }

  // Mirrors the server: favoriting an unrated title creates a default
  // (have_not_seen, neutral) preference carrying the flag.
  const applyFavorite = (itemId: string, isFavorite: boolean) => {
    const patch = (item: MediaItem): MediaItem =>
      item.id !== itemId ? item : {
        ...item,
        myPreference: {
          ...(item.myPreference ?? { status: 'have_not_seen', excitement: 3 }),
          isFavorite,
        },
      }
    setItems((prev) => prev.map(patch))
    setDetailModalItem((prev) => (prev ? patch(prev) : prev))
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
      notifyRoomsChanged()
      await loadItems()
    } catch (err) {
      console.error('Failed to remove from watched:', err)
      alert('Failed to remove title from watched')
    } finally {
      setMarkingWatchedItemId(null)
    }
  }

  const viewer = session?.user
    ? { id: session.user.id, name: session.user.name || 'You', imageUrl: myAvatar }
    : { id: 'user', name: '?', imageUrl: null }

  return (
    <div className={pageContainerClassName}>
      <PageHeaderBar>
        <PageHeader
          title='Browse'
          subtitle={isWatchedView
            ? "Titles you've already seen."
            : selectedRoomName
            ? `Rate and explore titles already in ${selectedRoomName}.`
            : 'Rate and explore titles already across your rooms.'}
          right={<RoomMembersAvatars />}
          className='mb-3'
        >
          <RoomSelector />
        </PageHeader>

        <div className='space-y-2.5'>
          <div className='relative'>
            <Search
              className='pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground'
              aria-hidden
            />
            <Input
              type='text'
              placeholder='Search your titles...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='w-full pl-10'
              aria-label='Search your titles'
            />
          </div>

          <div className='flex gap-2'>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label='Type'
              className='flex-1 [&>select]:h-10'
            >
              <option value='all'>All Types</option>
              <option value='movie'>Movies</option>
              <option value='show'>Shows</option>
              <option value='video'>Videos</option>
              <option value='link'>Links</option>
            </Select>

            <Select
              value={myStatusFilter}
              onChange={(e) => setMyStatusFilter(e.target.value)}
              aria-label='My status'
              className='flex-1 [&>select]:h-10'
            >
              <option value='all'>All Items</option>
              <option value='unrated'>Unrated</option>
              <option value='have_not_seen'>Have not seen</option>
              <option value='already_seen'>Already seen</option>
            </Select>
          </div>
        </div>
      </PageHeaderBar>

      <PageContent className='space-y-4'>
        <div ref={scrollContainerRef} className='space-y-4'>
          {loading
            ? <MediaCardSkeletonList count={3} ratings={2} />
            : items.length === 0
            ? (
              <EmptyState
                icon={debouncedSearch ? SearchX : Film}
                title={debouncedSearch
                  ? `No saved items match "${debouncedSearch}"`
                  : 'No saved items found'}
                description={debouncedSearch ? "Can't find what you're looking for?" : undefined}
                action={debouncedSearch
                  ? (
                    <Button
                      onClick={() => {
                        const params = new URLSearchParams()
                        if (roomId) params.set('roomId', roomId)
                        params.set('search', debouncedSearch)
                        router.push(`/add?${params.toString()}`)
                      }}
                    >
                      Search for &quot;{debouncedSearch}&quot; and add
                    </Button>
                  )
                  : undefined}
              />
            )
            : (
              items.map((item) => {
                const canDelete = item.createdByUserId === session?.user?.id
                const hint = searchMatchHint(item, debouncedSearch)
                const hasRatingRows = Boolean(item.myPreference) ||
                  Boolean(item.otherPreferences?.length)
                const openDetail = (e: React.MouseEvent) => {
                  e.stopPropagation()
                  setDetailModalItem(item)
                  loadTrailer(item)
                }
                return (
                  <MediaCard key={item.id} variant='default' className='relative'>
                    <CardRoomsBand
                      rooms={item.rooms ?? []}
                      emptyLabel='No rooms yet'
                      onClick={() => setEditingRoomsItem(item)}
                    />
                    <CardMenu className='!top-11'>
                      <MenuTrigger
                        label='Menu'
                        aria-expanded={openMenuId === item.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === item.id ? null : item.id)
                        }}
                      />
                      {openMenuId === item.id && (
                        <MenuPanel className='z-[9]'>
                          <MenuItem
                            icon={isWatchedView ? Eye : EyeOff}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (isWatchedView) {
                                handleRemoveFromWatched(item.id)
                              } else {
                                handleMarkAsWatched(item.id)
                              }
                            }}
                            disabled={markingWatchedItemId === item.id}
                          >
                            {markingWatchedItemId === item.id
                              ? 'Saving...'
                              : isWatchedView
                              ? 'Mark unwatched'
                              : 'Mark as watched'}
                          </MenuItem>
                          <MenuItem
                            icon={Pencil}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setOpenMenuId(null)
                              setEditingItem(item)
                            }}
                          >
                            Edit details
                          </MenuItem>
                          <div className='relative'>
                            <MenuItem
                              icon={Trash2}
                              destructive
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                if (canDelete) {
                                  setOpenMenuId(null)
                                  handleDelete(item)
                                }
                              }}
                              onMouseEnter={() => handleDeleteHover(item.id, canDelete)}
                              onMouseLeave={handleDeleteLeave}
                              disabled={!canDelete}
                              className={cn(!canDelete && 'text-muted-foreground')}
                            >
                              Delete
                            </MenuItem>
                            {tooltipItemId === item.id && !canDelete && (
                              <div className='absolute bottom-full left-0 z-50 mb-2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-pop'>
                                You can only delete items you created
                                <div className='absolute left-4 top-full border-4 border-transparent border-t-foreground'>
                                </div>
                              </div>
                            )}
                          </div>
                        </MenuPanel>
                      )}
                    </CardMenu>
                    <CardLayout>
                      <div
                        onClick={openDetail}
                        className='flex cursor-pointer flex-col items-center gap-1.5'
                      >
                        {item.myPreference?.isWatched && (
                          <Badge variant='muted' size='sm'>
                            <EyeOff className='h-3 w-3' />
                            Watched
                          </Badge>
                        )}
                        <CardPoster src={item.posterUrl} alt={item.title} width={80} height={120} />
                      </div>
                      <CardContent className='pr-10'>
                        <div onClick={openDetail} className='cursor-pointer'>
                          <CardTitle>{item.title}</CardTitle>
                          <CardMeta
                            icon={getTypeIcon(item.type)}
                            type={item.type}
                            releaseDate={item.releaseDate}
                            runtimeMinutes={item.runtimeMinutes}
                          />
                          {hint && (
                            <Badge variant='muted' size='sm' className='mb-1.5'>
                              {hint}
                            </Badge>
                          )}
                          <CardGenres genres={item.genres} maxDisplay={3} />
                          {item.description && (
                            <CardDescription lineClamp={2}>{item.description}</CardDescription>
                          )}
                          {isTmdbItem(item) && (
                            <StreamingProviders
                              tmdbId={item.tmdbId!}
                              type={item.type}
                              compact
                              className='mb-1'
                            />
                          )}
                        </div>
                      </CardContent>
                    </CardLayout>
                    <CardBand position='bottom' className='relative'>
                      {hasRatingRows && (
                        <div className='min-w-0 pr-10'>
                          {item.myPreference && (
                            <RatingLine
                              user={viewer}
                              excitement={item.myPreference.excitement}
                              status={item.myPreference.status}
                              isViewer
                              onClick={() => setSelectedItem(item)}
                            />
                          )}
                          {item.otherPreferences?.map((pref) => (
                            <RatingLine
                              key={pref.user.id}
                              user={pref.user}
                              excitement={pref.excitement}
                              status={pref.status}
                              isFavorite={pref.isFavorite}
                            />
                          ))}
                        </div>
                      )}
                      {!item.myPreference && (
                        <div className='py-1.5'>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedItem(item)
                            }}
                            size='sm'
                            className='w-full'
                          >
                            Add your excitement
                          </Button>
                        </div>
                      )}
                      <FavoriteButton
                        mediaItemId={item.id}
                        isFavorite={item.myPreference?.isFavorite === true}
                        onChange={(isFavorite) => applyFavorite(item.id, isFavorite)}
                        className='absolute right-1 top-1'
                      />
                    </CardBand>
                  </MediaCard>
                )
              })
            )}
        </div>
      </PageContent>

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
            // Rating "have not seen" clears the watched flag, which moves counts.
            notifyRoomsChanged()
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
          onFavoriteChange={(isFavorite) => applyFavorite(detailModalItem.id, isFavorite)}
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
            notifyRoomsChanged()
          }}
        />
      )}
    </div>
  )
}

function ItemDetailModal({
  item,
  onClose,
  onSave,
}: {
  item: MediaItem
  onClose: () => void
  roomId: string | null
  onSave?: () => void
}) {
  return (
    <Modal isOpen onClose={onClose} aria-label={`Rate ${item.title}`}>
      <ItemDetailBody item={item} onSave={onSave} />
    </Modal>
  )
}

function ItemDetailBody({ item, onSave }: { item: MediaItem; onSave?: () => void }) {
  const { handleClose } = useModal()
  const [status, setStatus] = useState(item.myPreference?.status || 'have_not_seen')
  const [excitement, setExcitement] = useState(item.myPreference?.excitement || 3)
  const [saving, setSaving] = useState(false)

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
    <>
      <ModalHeader title={item.title} />
      <ModalBody>
        <RatingFields
          status={status}
          excitement={excitement}
          onStatusChange={setStatus}
          onExcitementChange={setExcitement}
        />
      </ModalBody>
      <ModalFooter>
        <Button onClick={handleSave} disabled={saving} className='w-full'>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </ModalFooter>
    </>
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
  return (
    <Modal isOpen onClose={onClose} size='lg' dismissible={false} aria-label={`Edit ${item.title}`}>
      <EditItemBody item={item} onSave={onSave} />
    </Modal>
  )
}

function EditItemBody({ item, onSave }: { item: MediaItem; onSave: () => void }) {
  const isManual = item.sourceType?.toLowerCase() === 'manual'
  const [saving, setSaving] = useState(false)
  const { handleClose } = useModal()

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
  const [recommendedByName, setRecommendedByName] = useState(
    item.myPreference?.recommendedByName || '',
  )
  const [recommendationContext, setRecommendationContext] = useState(
    item.myPreference?.recommendationContext || '',
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
      if (
        notes !== item.myPreference?.notes ||
        recommendedByName !== item.myPreference?.recommendedByName ||
        recommendationContext !== item.myPreference?.recommendationContext
      ) {
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
    <>
      <ModalHeader title={`Edit ${item.title}`} />
      <ModalBody className='space-y-4'>
        {isManual
          ? (
            <>
              <Field label='Title' htmlFor='edit-title' required>
                <Input
                  id='edit-title'
                  type='text'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </Field>

              <Field label='Type' htmlFor='edit-type' required>
                <Select id='edit-type' value={type} onChange={(e) => setType(e.target.value)}>
                  <option value='movie'>Movie</option>
                  <option value='show'>Show</option>
                  <option value='video'>Video</option>
                  <option value='link'>Link</option>
                </Select>
              </Field>

              <Field label='Description' htmlFor='edit-description'>
                <Textarea
                  id='edit-description'
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </Field>

              <Field label='Genres' htmlFor='edit-genres' help='Comma-separated'>
                <Input
                  id='edit-genres'
                  type='text'
                  value={genres}
                  onChange={(e) => setGenres(e.target.value)}
                  placeholder='Action, Drama, Comedy'
                />
              </Field>

              <Field label='Poster URL' htmlFor='edit-poster-url'>
                <Input
                  id='edit-poster-url'
                  type='url'
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  placeholder='https://...'
                />
              </Field>

              <Field label='External URL' htmlFor='edit-external-url'>
                <Input
                  id='edit-external-url'
                  type='url'
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder='https://...'
                />
              </Field>

              <Field label='Runtime (minutes)' htmlFor='edit-runtime'>
                <Input
                  id='edit-runtime'
                  type='number'
                  value={runtimeMinutes}
                  onChange={(e) => setRuntimeMinutes(e.target.value)}
                  placeholder='120'
                />
              </Field>
            </>
          )
          : (
            <Notice>
              This item was added via TMDB search. You can only edit recommendation and notes
              information.
            </Notice>
          )}

        <Field label='Notes' htmlFor='edit-notes'>
          <Textarea
            id='edit-notes'
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder='Add your notes about this item...'
          />
        </Field>

        <Field label='Recommended by' htmlFor='edit-recommended-by'>
          <Input
            id='edit-recommended-by'
            type='text'
            value={recommendedByName}
            onChange={(e) => setRecommendedByName(e.target.value)}
            placeholder='Name of person who recommended this'
          />
        </Field>

        <Field label='Recommendation context' htmlFor='edit-recommendation-context'>
          <Textarea
            id='edit-recommendation-context'
            value={recommendationContext}
            onChange={(e) => setRecommendationContext(e.target.value)}
            rows={2}
            placeholder='Why was this recommended? When? Where?'
          />
        </Field>
      </ModalBody>
      <ModalFooter>
        <Button onClick={handleClose} variant='outline' className='flex-1'>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className='flex-1'>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </ModalFooter>
    </>
  )
}

function DetailModal({
  item,
  trailerUrl,
  loadingTrailer,
  onFavoriteChange,
  onClose,
}: {
  item: MediaItem
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
            isFavorite={item.myPreference?.isFavorite === true}
            onChange={onFavoriteChange}
            size={22}
            className='-mt-1.5'
          />
        }
        description={<SubmissionMeta submission={item.submission} />}
      />
      <ModalBody className='pb-6'>
        <MediaDetailBody item={item} trailerUrl={trailerUrl} loadingTrailer={loadingTrailer}>
          {item.myPreference?.recommendedByName && (
            <DetailSection title='Recommended by'>
              <p className='text-sm text-muted-foreground'>
                {item.myPreference.recommendedByName}
                {item.myPreference.recommendationContext && (
                  <span className='mt-1 block text-xs italic'>
                    {item.myPreference.recommendationContext}
                  </span>
                )}
              </p>
            </DetailSection>
          )}
        </MediaDetailBody>
      </ModalBody>
    </Modal>
  )
}
