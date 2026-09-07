'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { CheckCheck, PartyPopper } from 'lucide-react'
import { pageContainerClassName, PageHeader, PageHeaderBar } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Notice } from '@/components/ui/notice'
import { ConfirmModal } from '@/components/settings/ConfirmModal'
import { QueueDeck } from '@/components/queue/QueueDeck'
import { QueueDeckSkeleton } from '@/components/queue/QueueDeckSkeleton'
import { SwipeKey } from '@/components/queue/SwipeKey'
import { EXCITEMENT_BY_DIRECTION, QueueItem, SwipeDirection } from '@/components/queue/types'
import { cn } from '@/lib/utils'

/** What "accept all" writes to every title left in the queue. */
const ACCEPT_ALL_STATUS = 'have_not_seen'
const ACCEPT_ALL_EXCITEMENT = 3

export default function NewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [statusById, setStatusById] = useState<Record<string, string>>({})
  const [exit, setExit] = useState<{ itemId: string; direction: SwipeDirection } | null>(null)
  const [error, setError] = useState('')
  const [confirmingAcceptAll, setConfirmingAcceptAll] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    loadQueue()
  }, [session, status, router])

  // The deck shrinks as cards are rated; keep the centered index inside it.
  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, queue.length - 1)))
  }, [queue.length])

  const loadQueue = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/user/queue')
      if (res.ok) {
        const data = await res.json()
        setQueue(data.items || [])
      }
    } catch (err) {
      console.error('Failed to load queue data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Favoriting creates an unrated (ratedAt null) preference server-side, so the
  // title stays in the queue; mirror the new flag locally.
  const applyFavorite = (itemId: string, isFavorite: boolean) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id !== itemId ? item : {
          ...item,
          myPreference: {
            ...(item.myPreference ?? { status: 'have_not_seen', excitement: 3 }),
            isFavorite,
          },
        }
      )
    )
  }

  const requestExit = (direction: SwipeDirection) => {
    const item = queue[activeIndex]
    if (!item || exit) return
    setExit({ itemId: item.id, direction })
  }

  const rate = async (item: QueueItem, direction: SwipeDirection) => {
    const index = queue.findIndex((entry) => entry.id === item.id)

    setExit(null)
    setError('')
    setQueue((prev) => prev.filter((entry) => entry.id !== item.id))

    try {
      const res = await fetch(`/api/media/${item.id}/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: statusById[item.id] ?? 'have_not_seen',
          excitement: EXCITEMENT_BY_DIRECTION[direction],
        }),
      })
      if (!res.ok) throw new Error(`Preference save failed with ${res.status}`)
      window.dispatchEvent(new CustomEvent('queueUpdated'))
    } catch (err) {
      console.error('Failed to save preference:', err)
      setQueue((prev) => {
        if (prev.some((entry) => entry.id === item.id)) return prev
        const next = [...prev]
        next.splice(Math.max(0, Math.min(index, next.length)), 0, item)
        return next
      })
      setError(`We couldn't save your rating for ${item.title}. It's back in the deck — try again.`)
    }
  }

  const acceptAll = async (): Promise<string | void> => {
    const res = await fetch('/api/user/queue/accept-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: ACCEPT_ALL_STATUS, excitement: ACCEPT_ALL_EXCITEMENT }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      return data?.error || 'We could not clear your queue. Please try again.'
    }

    setError('')
    setExit(null)
    setQueue([])
    setActiveIndex(0)
    window.dispatchEvent(new CustomEvent('queueUpdated'))
  }

  const hasCards = queue.length > 0

  return (
    <div className={cn(pageContainerClassName, 'flex min-h-0 flex-1 flex-col')}>
      <PageHeaderBar className='space-y-2.5'>
        <PageHeader
          title='New'
          right={hasCards
            ? (
              <div className='flex items-center gap-2'>
                <Badge variant='muted' className='tabular-nums'>
                  {activeIndex + 1} of {queue.length}
                </Badge>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setConfirmingAcceptAll(true)}
                >
                  <CheckCheck className='h-4 w-4' aria-hidden />
                  Accept all
                </Button>
              </div>
            )
            : undefined}
        />

        {hasCards && <SwipeKey onRate={requestExit} className='mx-auto w-full max-w-md' />}
        {error && <Notice variant='error'>{error}</Notice>}
      </PageHeaderBar>

      <div className='min-h-0 flex-1 py-3'>
        {loading ? <QueueDeckSkeleton /> : !hasCards
          ? (
            <EmptyState
              icon={PartyPopper}
              title='Nothing left to rate'
              description='New titles your rooms add will show up here.'
            />
          )
          : (
            <QueueDeck
              items={queue}
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
              statusById={statusById}
              onStatusChange={(itemId, value) =>
                setStatusById((prev) => ({ ...prev, [itemId]: value }))}
              onRate={rate}
              onFavoriteChange={applyFavorite}
              exit={exit}
            />
          )}
      </div>

      <ConfirmModal
        open={confirmingAcceptAll}
        title={`Accept all ${queue.length} title${queue.length === 1 ? '' : 's'}?`}
        description={
          <>
            <p>
              Every title left in your queue is rated <strong>Neutral</strong> and{' '}
              <strong>Have not seen</strong>, and the queue is cleared.
            </p>
            <p>You can change any of them later from Browse.</p>
          </>
        }
        confirmLabel='Accept all'
        busyLabel='Clearing…'
        onConfirm={acceptAll}
        onClose={() => setConfirmingAcceptAll(false)}
      />
    </div>
  )
}
