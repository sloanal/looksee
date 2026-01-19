'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Film, Tv, Video, Link as LinkIcon, Calendar, Sofa, Frown, Meh, Smile } from 'lucide-react'
import { DuotoneIcon } from '@/components/DuotoneIcon'
import { useModalAnimation } from '@/lib/useModalAnimation'
import { Button } from '@/components/ui/button'
import {
  MediaCard,
  CardLayout,
  CardPoster,
  CardContent,
  CardTitle,
  CardSubtitle,
  CardDescription,
  CardGenres,
} from '@/components/MediaCard'

interface QueueItem {
  id: string
  title: string
  type: string
  posterUrl?: string
  description?: string
  genres: string[]
  releaseDate?: string
  createdBy: string
  createdByUserId?: string
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
  otherPreferences?: Array<{
    status: string
    excitement: number
    user: {
      id: string
      name: string
      imageUrl?: string | null
    }
  }>
}

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

const getStatusLabel = (status?: string) => {
  if (!status) return 'Unrated'
  const labels: Record<string, string> = {
    have_not_seen: 'Have not seen',
    already_seen: 'Already seen',
  }
  return labels[status] || status
}

const getExcitementLabel = (excitement?: number) => {
  if (!excitement) return ''
  const labels: Record<number, string> = {
    1: 'Not excited',
    3: 'Neutral',
    5: 'Excited',
  }
  return labels[excitement] || ''
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
      // Use multiple animation frames to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({
            top: scrollPositionRef.current!,
            behavior: 'instant'
          })
          scrollPositionRef.current = null
        })
      })
    }
  }, [loading, queue.length])

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


  return (
    <div className="max-w-4xl mx-auto">
      <div className="sticky top-0 bg-background border-b border-border z-10 p-4">
        <h1 className="text-2xl font-bold text-foreground mb-2">New</h1>
        <p className="text-sm text-muted-foreground">Add your excitement to these movies and shows added by other people in your rooms.</p>
      </div>

      <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
        <div ref={queueContainerRef} className="p-4 space-y-4 bg-content min-h-[calc(100vh-200px)]">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : queue.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-lg">No items in your queue</p>
              <p className="text-sm mt-2">All media items have been rated!</p>
            </div>
          ) : (
            queue.map((item) => (
              <MediaCard key={item.id} variant="default" className="relative">
                {item.rooms && item.rooms.length > 0 && (
                  <div className="flex items-center justify-between -mx-4 -mt-4 px-4 pt-3 pb-2 mb-2 border-b border-border bg-muted/50">
                    <div className="flex items-center gap-2 flex-wrap flex-1">
                      <DuotoneIcon icon={Sofa} size={14} />
                      {item.rooms.map((room) => (
                        <span
                          key={room.id}
                          className="px-2 py-0.5 bg-foreground/10 text-foreground text-xs rounded"
                        >
                          {room.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <CardLayout>
                  <div
                onClick={(e) => {
                  e.stopPropagation()
                  scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop
                  setSelectedQueueItem(item)
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
                  scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop
                  setSelectedQueueItem(item)
                  loadTrailer(item)
                }}
                      className="cursor-pointer"
                    >
                      <CardTitle>{item.title}</CardTitle>
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
                        <CardDescription>{item.description}</CardDescription>
                      )}
                    </div>
                  </CardContent>
                </CardLayout>
                <div className="space-y-0.5 -mx-4 -mb-4 px-4 pt-1 pb-1 border-t border-border mt-2 bg-muted/50">
                  <div className="flex justify-center pt-1 pb-2">
                    <Button
                onClick={(e) => {
                  e.stopPropagation()
                  scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop
                  setSelectedQueueItem(item)
                  loadTrailer(item)
                }}
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                    >
                      Add your excitement
                    </Button>
                  </div>
                </div>
              </MediaCard>
            ))
          )}
        </div>
      </div>

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
        />
      )}
    </div>
  )
}

function QueueItemModal({
  item,
  trailerUrl,
  loadingTrailer,
  onClose,
  onSave,
}: {
  item: QueueItem
  trailerUrl: string | null
  loadingTrailer: boolean
  onClose: () => void
  onSave: () => void
}) {
  const [status, setStatus] = useState('have_not_seen')
  const [excitement, setExcitement] = useState(3)
  const [saving, setSaving] = useState(false)
  const { isClosing, handleClose } = useModalAnimation(onClose)

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
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center pt-4 px-4 pb-20 modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div 
        className={`bg-card rounded-lg max-w-4xl w-full h-[calc(100vh-6rem)] flex flex-col modal-content ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pt-4 overflow-y-auto flex-1">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-foreground">{item.title}</h2>
            <button onClick={handleClose} className="text-muted-foreground text-2xl hover:text-foreground">
              ×
            </button>
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

          <div className="border-t border-border pt-6 mt-6">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Add Your Rating</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-foreground">Your status</label>
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
              <label className="block text-sm font-medium mb-2 text-foreground">
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

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
