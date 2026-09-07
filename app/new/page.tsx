'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Film, Link as LinkIcon, PartyPopper, Tv, Video } from 'lucide-react'
import {
  pageContainerClassName,
  PageContent,
  PageHeader,
  PageHeaderBar,
} from '@/components/PageHeader'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Modal, ModalBody, ModalFooter, ModalHeader, useModal } from '@/components/ui/modal'
import { FavoriteButton, FavoritedByBadge } from '@/components/FavoriteButton'
import { SubmissionInfo, SubmissionMeta } from '@/components/SubmissionMeta'
import { MediaDetailBody } from '@/components/MediaDetail'
import { RatingFields } from '@/components/RatingFields'
import {
  CardBand,
  CardContent,
  CardDescription,
  CardGenres,
  CardLayout,
  CardMeta,
  CardPoster,
  CardRoomsBand,
  CardTitle,
  MediaCard,
} from '@/components/MediaCard'

interface QueueItem {
  id: string
  title: string
  type: string
  posterUrl?: string
  description?: string
  genres: string[]
  releaseDate?: string
  rating?: number
  createdBy: string
  createdByUserId?: string
  createdByImageUrl?: string | null
  roomId: string
  roomName: string
  tmdbId?: string | null
  sourceType?: string
  rooms?: Array<{
    id: string
    name: string
    addedByUserId: string
    addedByName: string
  }>
  myPreference?: {
    status: string
    excitement: number
    isFavorite?: boolean
  } | null
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
  submission?: SubmissionInfo | null
}

const favoritedByNames = (item: QueueItem): string[] =>
  (item.otherPreferences ?? []).filter((pref) => pref.isFavorite).map((pref) => pref.user.name)

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

export default function NewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null)
  const [myAvatar, setMyAvatar] = useState<string | null>(null)
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null)
  const [loadingTrailer, setLoadingTrailer] = useState(false)
  const queueContainerRef = useRef<HTMLDivElement>(null)
  const scrollPositionRef = useRef<number | null>(null)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }
    loadData()
    loadMyAvatar()
  }, [session, status, router])

  // Restore scroll position after queue loads
  useEffect(() => {
    if (!loading && queue.length > 0 && scrollPositionRef.current !== null) {
      const position = scrollPositionRef.current
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
          scrollPositionRef.current = null
        })
      })
    }
  }, [loading, queue.length])

  // Restore scroll position when modal closes (Safari fix)
  useEffect(() => {
    if (selectedQueueItem === null && scrollPositionRef.current !== null) {
      const position = scrollPositionRef.current
      // Safari can reset scroll position when modal closes, so we need to restore it
      // Wait for modal animation to complete (200ms) plus extra time for Safari
      setTimeout(() => {
        // Use triple requestAnimationFrame for Safari - needs even more time
        requestAnimationFrame(() => {
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
              // Also try scrolling the container if it exists
              if (queueContainerRef.current) {
                queueContainerRef.current.scrollTop = position
              }
              scrollPositionRef.current = null
            })
          })
        })
      }, 250) // Wait for modal animation (200ms) + buffer
    }
  }, [selectedQueueItem])

  const loadData = async () => {
    setLoading(true)
    try {
      const queueRes = await fetch('/api/user/queue')

      if (queueRes.ok) {
        const queueData = await queueRes.json()
        setQueue(queueData.items || [])
      }
    } catch (err) {
      console.error('Failed to load queue data:', err)
    } finally {
      setLoading(false)
    }
  }

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

  async function loadTrailer(item: QueueItem) {
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

  // Favoriting creates an unrated (ratedAt null) preference server-side, so the
  // title stays in the queue; mirror the new flag locally.
  const applyFavorite = (itemId: string, isFavorite: boolean) => {
    const patch = (item: QueueItem): QueueItem =>
      item.id !== itemId ? item : {
        ...item,
        myPreference: {
          ...(item.myPreference ?? { status: 'have_not_seen', excitement: 3 }),
          isFavorite,
        },
      }
    setQueue((prev) => prev.map(patch))
    setSelectedQueueItem((prev) => (prev ? patch(prev) : prev))
  }

  const openItem = (item: QueueItem) => {
    // Get scroll position with multiple fallbacks for Safari compatibility
    scrollPositionRef.current = window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0
    setSelectedQueueItem(item)
    loadTrailer(item)
  }

  return (
    <div className={pageContainerClassName}>
      <PageHeaderBar>
        <PageHeader title='New' subtitle='Rate titles other people in your rooms have added.' />
      </PageHeaderBar>

      <PageContent>
        <div ref={queueContainerRef} className='space-y-4'>
          {loading
            ? <div className='py-8 text-center text-sm text-muted-foreground'>Loading...</div>
            : queue.length === 0
            ? (
              <EmptyState
                icon={PartyPopper}
                title='No items in your queue'
                description='All media items have been rated!'
              />
            )
            : (
              queue.map((item) => (
                <MediaCard key={item.id} variant='default' className='relative'>
                  {item.rooms && item.rooms.length > 0 && <CardRoomsBand rooms={item.rooms} />}
                  <CardLayout>
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        openItem(item)
                      }}
                      className='cursor-pointer'
                    >
                      <CardPoster src={item.posterUrl} alt={item.title} width={80} height={120} />
                    </div>
                    <CardContent>
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          openItem(item)
                        }}
                        className='cursor-pointer'
                      >
                        <CardTitle>{item.title}</CardTitle>
                        <CardMeta
                          icon={getTypeIcon(item.type)}
                          type={item.type}
                          releaseDate={item.releaseDate}
                        />
                        <CardGenres genres={item.genres} maxDisplay={3} />
                        {item.description && <CardDescription>{item.description}</CardDescription>}
                      </div>
                    </CardContent>
                  </CardLayout>
                  <CardBand
                    position='bottom'
                    className='flex flex-wrap items-center gap-x-3 gap-y-2'
                  >
                    <div className='flex min-w-0 flex-1 items-center gap-2 py-1'>
                      <Avatar
                        user={{
                          id: item.createdByUserId ?? item.id,
                          name: item.createdBy,
                          imageUrl: item.createdByImageUrl,
                        }}
                        size='sm'
                      />
                      <p className='truncate text-xs text-muted-foreground'>
                        Added by {item.createdBy}
                      </p>
                      <FavoritedByBadge names={favoritedByNames(item)} />
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        openItem(item)
                      }}
                      size='sm'
                      className='order-last w-full sm:order-none sm:w-auto'
                    >
                      Add your excitement
                    </Button>
                    <FavoriteButton
                      mediaItemId={item.id}
                      isFavorite={item.myPreference?.isFavorite === true}
                      onChange={(isFavorite) => applyFavorite(item.id, isFavorite)}
                      className='-mr-3 sm:order-last'
                    />
                  </CardBand>
                </MediaCard>
              ))
            )}
        </div>
      </PageContent>

      {selectedQueueItem && (
        <QueueItemModal
          item={selectedQueueItem}
          trailerUrl={trailerUrl}
          loadingTrailer={loadingTrailer}
          onClose={() => {
            setSelectedQueueItem(null)
            setTrailerUrl(null)
          }}
          onSave={() => {
            setSelectedQueueItem(null)
            setTrailerUrl(null)
            loadData()
          }}
          onFavoriteChange={(isFavorite) => applyFavorite(selectedQueueItem.id, isFavorite)}
        />
      )}
    </div>
  )
}

interface QueueItemModalProps {
  item: QueueItem
  trailerUrl: string | null
  loadingTrailer: boolean
  onClose: () => void
  onSave: () => void
  onFavoriteChange: (isFavorite: boolean) => void
}

function QueueItemModal({ onClose, ...rest }: QueueItemModalProps) {
  return (
    <Modal isOpen onClose={onClose} size='xl' tall aria-label={`Rate ${rest.item.title}`}>
      <QueueItemBody {...rest} />
    </Modal>
  )
}

function QueueItemBody({
  item,
  trailerUrl,
  loadingTrailer,
  onSave,
  onFavoriteChange,
}: Omit<QueueItemModalProps, 'onClose'>) {
  const [status, setStatus] = useState('have_not_seen')
  const [excitement, setExcitement] = useState(3)
  const [saving, setSaving] = useState(false)
  const { handleClose } = useModal()

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/media/${item.id}/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, excitement }),
      })

      if (res.ok) {
        // Dispatch custom event to update badge count immediately
        window.dispatchEvent(new CustomEvent('queueUpdated'))
        handleClose()
        onSave()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to save preference')
      }
    } catch (err) {
      console.error('Failed to save preference:', err)
      alert('Failed to save preference')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
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
      <ModalBody>
        <MediaDetailBody item={item} trailerUrl={trailerUrl} loadingTrailer={loadingTrailer} />

        <div className='border-t border-border pt-5'>
          <h3 className='mb-3 text-base font-semibold text-foreground'>Add your rating</h3>
          <RatingFields
            status={status}
            excitement={excitement}
            onStatusChange={setStatus}
            onExcitementChange={setExcitement}
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button onClick={handleSave} disabled={saving} className='w-full'>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </ModalFooter>
    </>
  )
}
