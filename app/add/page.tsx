'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'

interface TMDBResult {
  id: number
  title: string
  releaseDate?: string
  posterPath?: string
  type: 'movie' | 'show'
  overview?: string
}

interface TMDBDetails {
  id: number
  title: string
  type: 'movie' | 'show'
  overview?: string
  posterUrl?: string
  genres: string[]
  runtimeMinutes?: number
  releaseDate?: string
}

export default function AddPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')

  const [mode, setMode] = useState<'search' | 'manual' | 'confirm'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([])
  const [selectedResult, setSelectedResult] = useState<TMDBDetails | null>(null)
  const [loading, setLoading] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'movie' | 'show' | 'other'>('movie')
  const [externalUrl, setExternalUrl] = useState('')
  const [description, setDescription] = useState('')
  const [genres, setGenres] = useState('')
  const [recommendedByName, setRecommendedByName] = useState('')
  const [recommendationContext, setRecommendationContext] = useState('')
  const [status, setStatus] = useState('not_seen_want')
  const [excitement, setExcitement] = useState(3)

  useEffect(() => {
    if (sessionStatus === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    if (!roomId) {
      fetch('/api/rooms')
        .then((res) => res.json())
        .then((data) => {
          if (data.rooms && data.rooms.length > 0) {
            router.push(`/add?roomId=${data.rooms[0].id}`)
          } else {
            router.push('/rooms/setup')
          }
        })
    }
  }, [session, sessionStatus, roomId, router])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setSearchResults([])
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
  }

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
      setMode('confirm')
    } catch (err) {
      console.error('Failed to fetch details:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomId) return

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
        status,
        excitement: parseInt(excitement.toString()),
        notes: null,
        recommendedByName: recommendedByName || null,
        recommendationContext: recommendationContext || null,
      }

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
    } catch (err) {
      console.error('Failed to add item:', err)
      alert('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!roomId) {
    return <div className="p-4">Loading...</div>
  }

  if (mode === 'confirm') {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-4">
          <button
            onClick={() => {
              setMode('search')
              setSelectedResult(null)
            }}
            className="text-blue-600"
          >
            ← Back
          </button>
        </div>

        <h1 className="text-2xl font-bold mb-4">Confirm Details</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Genres (comma-separated)</label>
            <input
              type="text"
              value={genres}
              onChange={(e) => setGenres(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Recommended by</label>
            <input
              type="text"
              value={recommendedByName}
              onChange={(e) => setRecommendedByName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              placeholder="Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Recommendation notes</label>
            <textarea
              value={recommendationContext}
              onChange={(e) => setRecommendationContext(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              placeholder="Why was this recommended?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">My Status *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value="not_seen_want">Haven't seen, want to watch</option>
              <option value="not_seen_dont_want">Haven't seen, don't want to watch</option>
              <option value="seen_would_rewatch">Seen, would rewatch</option>
              <option value="seen_wont_rewatch">Seen, would not rewatch</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              My Excitement: {excitement}/5 *
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={excitement}
              onChange={(e) => setExcitement(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add to Room'}
          </button>
        </form>
      </div>
    )
  }

  if (mode === 'manual') {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-4">
          <button onClick={() => setMode('search')} className="text-blue-600">
            ← Back to Search
          </button>
        </div>

        <h1 className="text-2xl font-bold mb-4">Add Manually</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Genres (comma-separated)</label>
            <input
              type="text"
              value={genres}
              onChange={(e) => setGenres(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Recommended by</label>
            <input
              type="text"
              value={recommendedByName}
              onChange={(e) => setRecommendedByName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Recommendation notes</label>
            <textarea
              value={recommendationContext}
              onChange={(e) => setRecommendationContext(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">My Status *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value="not_seen_want">Haven't seen, want to watch</option>
              <option value="not_seen_dont_want">Haven't seen, don't want to watch</option>
              <option value="seen_would_rewatch">Seen, would rewatch</option>
              <option value="seen_wont_rewatch">Seen, would not rewatch</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              My Excitement: {excitement}/5 *
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={excitement}
              onChange={(e) => setExcitement(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add to Room'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Add Title</h1>

      <div className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search TMDB for a movie or show..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Search
          </button>
        </div>
        <button
          onClick={() => setMode('manual')}
          className="mt-2 text-sm text-blue-600 hover:underline"
        >
          Or add manually
        </button>
      </div>

      {loading && searchQuery && (
        <div className="text-center text-gray-500 py-8">Searching...</div>
      )}

      {searchResults.length > 0 && (
        <div className="space-y-2">
          {searchResults.map((result) => (
            <div
              key={`${result.type}-${result.id}`}
              onClick={() => handleSelectResult(result)}
              className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4">
                {result.posterPath && (
                  <Image
                    src={`https://image.tmdb.org/t/p/w92${result.posterPath}`}
                    alt={result.title}
                    width={92}
                    height={138}
                    className="rounded"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{result.title}</h3>
                  <p className="text-sm text-gray-600 capitalize">{result.type}</p>
                  {result.releaseDate && (
                    <p className="text-sm text-gray-500">
                      {new Date(result.releaseDate).getFullYear()}
                    </p>
                  )}
                  {result.overview && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{result.overview}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

