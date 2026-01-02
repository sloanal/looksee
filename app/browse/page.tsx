'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { RoomSelector } from '@/components/RoomSelector'

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
  myPreference?: {
    status: string
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
}

export default function BrowsePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')

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
  const [tooltipItemId, setTooltipItemId] = useState<string | null>(null)
  const [tooltipTimeout, setTooltipTimeout] = useState<NodeJS.Timeout | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (myStatusFilter !== 'unrated') params.set('myStatus', myStatusFilter)

    try {
      let url: string
      if (roomId) {
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
    const labels: Record<string, string> = {
      not_seen_want: 'Want to see',
      not_seen_dont_want: 'Not interested',
      seen_would_rewatch: 'Seen / rewatch',
      seen_wont_rewatch: 'Seen, would not rewatch',
    }
    return labels[status] || status
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="sticky top-0 bg-white border-b z-10 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Browse</h1>
          <RoomSelector />
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Search titles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          <div className="flex gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
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
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="unrated">All Items</option>
              <option value="not_seen_want">Want to see</option>
              <option value="seen_would_rewatch">Seen / rewatch</option>
              <option value="seen_wont_rewatch">Seen, would not rewatch</option>
              <option value="not_seen_dont_want">Not interested</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-center text-gray-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="p-4 text-center text-gray-500">No items found</div>
      ) : (
        <div className="p-4 space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow relative"
            >
              <div className="absolute top-2 right-2 z-0" data-menu-container>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(openMenuId === item.id ? null : item.id)
                  }}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
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
                  <div 
                    className="absolute right-0 mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-[9]"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setOpenMenuId(null)
                        setEditingItem(item)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
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
                      Edit
                    </button>
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
                            ? 'text-red-600 hover:bg-gray-100'
                            : 'text-gray-400 cursor-not-allowed'
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
                        <div className="absolute bottom-full left-0 mb-2 z-50 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                          You can only delete items you created
                          <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-4">
                {item.posterUrl && (
                  <div className="flex-shrink-0">
                    <Image
                      src={item.posterUrl}
                      alt={item.title}
                      width={80}
                      height={120}
                      className="rounded object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0 pr-12">
                  <h3 className="font-semibold text-base mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600 mb-2 capitalize">{item.type}</p>
                  {item.description && (
                    <p className="text-sm text-gray-500 mb-2 line-clamp-2">{item.description}</p>
                  )}
                  {item.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.genres.slice(0, 3).map((genre, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      {item.myPreference ? (
                        <>
                          <div className="flex items-center gap-2">
                            {myAvatar ? (
                              <div className="w-6 h-6 flex-shrink-0">
                                <Image
                                  src={myAvatar}
                                  alt={session?.user?.name || 'You'}
                                  width={24}
                                  height={24}
                                  className="rounded-full object-cover w-full h-full"
                                  unoptimized
                                />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs flex-shrink-0">
                                {(session?.user?.name?.[0] || '?').toUpperCase()}
                              </div>
                            )}
                            <span className="text-gray-500 font-medium">My Vibe:</span>
                            <span className="text-gray-600">
                              {getStatusLabel(item.myPreference.status)} •{' '}
                              {'⭐'.repeat(item.myPreference.excitement)}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedItem(item)
                            }}
                            className="ml-1 p-1 text-gray-500 hover:text-blue-600 transition-colors"
                            aria-label="Edit preference"
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
                          </button>
                          {item.myPreference.recommendedByName && (
                            <span className="text-gray-500">
                              • Recommended by {item.myPreference.recommendedByName}
                            </span>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedItem(item)
                          }}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {item.otherPreferences && item.otherPreferences.length > 0 && (
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        {item.otherPreferences.map((pref) => (
                          <div key={pref.user.id} className="flex items-center gap-2">
                            {pref.user.imageUrl ? (
                              <div className="w-6 h-6 flex-shrink-0">
                                <Image
                                  src={pref.user.imageUrl}
                                  alt={pref.user.name}
                                  width={24}
                                  height={24}
                                  className="rounded-full object-cover w-full h-full"
                                  unoptimized
                                />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs flex-shrink-0">
                                {(pref.user.name[0] || '?').toUpperCase()}
                              </div>
                            )}
                            <span className="text-gray-600">
                              {pref.user.name}: {getStatusLabel(pref.status)} •{' '}
                              {'⭐'.repeat(pref.excitement)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedItem && (
        <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} roomId={roomId} />
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
    </div>
  )
}

function ItemDetailModal({
  item,
  onClose,
  roomId,
}: {
  item: MediaItem
  onClose: () => void
  roomId: string | null
}) {
  const [status, setStatus] = useState(item.myPreference?.status || 'not_seen_want')
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
      onClose()
      window.location.reload()
    } catch (err) {
      console.error('Failed to save preference:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold">{item.title}</h2>
            <button onClick={onClose} className="text-gray-500 text-2xl">
              ×
            </button>
          </div>

          {item.posterUrl && (
            <div className="mb-4">
              <Image
                src={item.posterUrl}
                alt={item.title}
                width={200}
                height={300}
                className="rounded mx-auto"
              />
            </div>
          )}

          {item.description && (
            <div className="mb-4">
              <p className="text-sm text-gray-700 leading-relaxed">{item.description}</p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Status</label>
            <div className="space-y-2">
              {[
                { value: 'not_seen_want', label: "Haven&apos;t seen, want to watch" },
                { value: 'not_seen_dont_want', label: "Haven&apos;t seen, don&apos;t want to watch" },
                { value: 'seen_would_rewatch', label: 'Seen, would rewatch' },
                { value: 'seen_wont_rewatch', label: 'Seen, would not rewatch' },
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
              Excitement: {excitement}/5
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={excitement}
              onChange={(e) => setExcitement(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1</span>
              <span>5</span>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
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

      onSave()
    } catch (err) {
      console.error('Failed to save:', err)
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold">Edit {item.title}</h2>
            <button onClick={onClose} className="text-gray-500 text-2xl">
              ×
            </button>
          </div>

          {isManual ? (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Type *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="movie">Movie</option>
                  <option value="show">Show</option>
                  <option value="video">Video</option>
                  <option value="link">Link</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Genres (comma-separated)</label>
                <input
                  type="text"
                  value={genres}
                  onChange={(e) => setGenres(e.target.value)}
                  placeholder="Action, Drama, Comedy"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Poster URL</label>
                <input
                  type="url"
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">External URL</label>
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Runtime (minutes)</label>
                <input
                  type="number"
                  value={runtimeMinutes}
                  onChange={(e) => setRuntimeMinutes(e.target.value)}
                  placeholder="120"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </>
          ) : (
            <div className="mb-4 p-4 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-800">
                This item was added via TMDB search. You can only edit recommendation and notes information.
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Add your notes about this item..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Recommended By</label>
            <input
              type="text"
              value={recommendedByName}
              onChange={(e) => setRecommendedByName(e.target.value)}
              placeholder="Name of person who recommended this"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Recommendation Context</label>
            <textarea
              value={recommendationContext}
              onChange={(e) => setRecommendationContext(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Why was this recommended? When? Where?"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

