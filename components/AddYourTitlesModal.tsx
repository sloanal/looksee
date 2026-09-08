'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal, ModalBody, ModalFooter, ModalHeader, useModal } from '@/components/ui/modal'
import { Notice } from '@/components/ui/notice'
import { PosterImage } from '@/components/PosterImage'
import { LIBRARY_GROUPS, LibraryGroupKey } from '@/lib/library-groups'
import { formatTitleCount, notifyRoomsChanged } from '@/lib/rooms'
import { clientSubmissionContext } from '@/lib/submission-context'
import { cn } from '@/lib/utils'

interface AddYourTitlesModalProps {
  isOpen: boolean
  roomId: string | null
  roomName?: string
  /** A room they just made starts empty; a joined room already has other people in it. */
  variant?: 'created' | 'joined'
  /** "Not now", a dismissal, and "Done" all land here — the caller owns what comes next. */
  onDismiss: () => void
  /** Fires after titles land in the room so the page can refresh its own counts. */
  onAdded?: (added: number) => void
  /** Offers the Letterboxd export for people with nothing in Looksee yet. */
  onImportLetterboxd?: () => void
}

/**
 * Post create/join step: copy titles the person already has in Looksee into
 * the room, either by picking whole slices of their library (what they want to
 * watch, are excited about, have seen…) or by ticking individual titles.
 * Everything here only creates room joins — no title is created or re-rated.
 */
export function AddYourTitlesModal({
  isOpen,
  roomId,
  roomName,
  variant = 'joined',
  onDismiss,
  onAdded,
  onImportLetterboxd,
}: AddYourTitlesModalProps) {
  const [busy, setBusy] = useState(false)
  const open = isOpen && roomId !== null

  return (
    <Modal
      isOpen={open}
      onClose={onDismiss}
      dismissible={!busy}
      aria-label='Add your titles'
    >
      {open && (
        <AddYourTitlesBody
          key={roomId}
          roomId={roomId}
          roomName={roomName}
          variant={variant}
          onAdded={onAdded}
          onImportLetterboxd={onImportLetterboxd}
          onBusyChange={setBusy}
        />
      )}
    </Modal>
  )
}

type LibraryTitle = {
  id: string
  title: string
  posterUrl: string | null
  releaseDate: string | null
  groups: LibraryGroupKey[]
}

type Library = {
  counts: Record<string, number>
  candidateCount: number
  libraryCount: number
  titles: LibraryTitle[]
  truncated: boolean
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'choose' }
  | { kind: 'manual' }
  | { kind: 'done'; added: number }

interface AddYourTitlesBodyProps {
  roomId: string
  roomName?: string
  variant: 'created' | 'joined'
  onAdded?: (added: number) => void
  onImportLetterboxd?: () => void
  onBusyChange: (busy: boolean) => void
}

function AddYourTitlesBody({
  roomId,
  roomName,
  variant,
  onAdded,
  onImportLetterboxd,
  onBusyChange,
}: AddYourTitlesBodyProps) {
  const router = useRouter()
  const { handleClose } = useModal()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [library, setLibrary] = useState<Library | null>(null)
  const [selectedGroups, setSelectedGroups] = useState<LibraryGroupKey[]>([])
  const [pickedIds, setPickedIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const roomLabel = roomName || 'the room'
  const toRoom = roomName ? ` to ${roomName}` : ' to the room'

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    setError('')
    setPhase({ kind: 'loading' })
    try {
      const res = await fetch(`/api/rooms/${roomId}/import-library`)
      const data = await res.json().catch(() => ({}))
      if (isCancelled()) return
      if (!res.ok) {
        setError(data.error || "Couldn't check your library. Please try again.")
        setPhase({ kind: 'failed' })
        return
      }
      const counts: Record<string, number> = {}
      for (const group of data.groups ?? []) {
        counts[group.key] = Number(group.count) || 0
      }
      setLibrary({
        counts,
        candidateCount: Number(data.candidateCount) || 0,
        libraryCount: Number(data.libraryCount) || 0,
        titles: Array.isArray(data.titles) ? data.titles : [],
        truncated: data.truncated === true,
      })
      // Everything they want to watch is the usual answer, so start there.
      setSelectedGroups(counts.want_to_watch > 0 ? ['want_to_watch'] : [])
      setPhase({ kind: 'choose' })
    } catch (err) {
      console.error('Failed to check library:', err)
      if (isCancelled()) return
      setError("Couldn't check your library. Please try again.")
      setPhase({ kind: 'failed' })
    }
  }, [roomId])

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  const groups = useMemo(
    () => LIBRARY_GROUPS.filter((group) => (library?.counts[group.key] ?? 0) > 0),
    [library],
  )

  // Groups overlap (a favorite is often also on the watchlist), so the honest
  // number is the distinct titles behind the selection. Past the checklist cap
  // we only have the per-group counts, so the button drops the number.
  const selectedCount = useMemo(() => {
    if (!library) return 0
    if (library.truncated) return null
    return library.titles.filter((title) =>
      title.groups.some((group) => selectedGroups.includes(group))
    ).length
  }, [library, selectedGroups])

  const shownTitles = useMemo(() => {
    if (!library) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return library.titles
    return library.titles.filter((title) => title.title.toLowerCase().includes(needle))
  }, [library, query])

  const toggleGroup = (key: LibraryGroupKey) =>
    setSelectedGroups((current) =>
      current.includes(key) ? current.filter((group) => group !== key) : [...current, key]
    )

  const togglePicked = (id: string) =>
    setPickedIds((current) =>
      current.includes(id) ? current.filter((picked) => picked !== id) : [...current, id]
    )

  const openManualPicker = () => {
    // Carry the group selection over so ticking a few extras is easy.
    setPickedIds(
      (library?.titles ?? [])
        .filter((title) => title.groups.some((group) => selectedGroups.includes(group)))
        .map((title) => title.id),
    )
    setQuery('')
    setError('')
    setPhase({ kind: 'manual' })
  }

  const add = async (payload: { groups: LibraryGroupKey[] } | { mediaItemIds: string[] }) => {
    setError('')
    setAdding(true)
    onBusyChange(true)
    try {
      const res = await fetch(`/api/rooms/${roomId}/import-library`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...clientSubmissionContext(), ...payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Couldn't add your titles. Please try again.")
        return
      }
      const added = Number(data.added) || 0
      notifyRoomsChanged()
      onAdded?.(added)
      setPhase({ kind: 'done', added })
    } catch (err) {
      console.error('Failed to add titles to room:', err)
      setError("Couldn't add your titles. Please try again.")
    } finally {
      setAdding(false)
      onBusyChange(false)
    }
  }

  const errorBanner = error ? <Notice variant='error'>{error}</Notice> : null

  const letterboxdOption = onImportLetterboxd
    ? (
      <button
        type='button'
        onClick={onImportLetterboxd}
        className='mx-auto block min-h-[44px] text-sm font-medium text-foreground underline-offset-4 hover:underline'
      >
        Or import from Letterboxd
      </button>
    )
    : null

  if (phase.kind === 'done') {
    return (
      <>
        <ModalHeader
          title={phase.added > 0 ? "You're all set" : 'Nothing new to add'}
          showClose={false}
        />
        <ModalBody className='space-y-3 text-sm text-muted-foreground'>
          <p>
            {phase.added > 0
              ? `Added ${formatTitleCount(phase.added)}${toRoom}.`
              : `Those were already in ${roomLabel}.`}
          </p>
          {phase.added > 0 && (
            <p>
              Everyone in the room can see what you&apos;re into now, so recommendations will get
              better right away.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant='secondary'
            className='flex-1'
            onClick={() => router.push(`/add?roomId=${roomId}`)}
          >
            Add something else
          </Button>
          <Button className='flex-1' onClick={handleClose}>
            Done
          </Button>
        </ModalFooter>
      </>
    )
  }

  if (phase.kind === 'loading' || phase.kind === 'failed') {
    return (
      <>
        <ModalHeader title='Add your titles' showClose={false} />
        <ModalBody className='space-y-3 text-sm text-muted-foreground'>
          <p>
            {phase.kind === 'loading'
              ? 'Looking through your library…'
              : "Couldn't check your library."}
          </p>
          {errorBanner}
        </ModalBody>
        <ModalFooter>
          <Button variant='secondary' className='flex-1' onClick={handleClose}>
            Not now
          </Button>
          {phase.kind === 'failed'
            ? (
              <Button className='flex-1' onClick={() => load()}>
                Try again
              </Button>
            )
            : (
              <Button className='flex-1' disabled>
                <Loader2 className='h-4 w-4 animate-spin' />
                Checking…
              </Button>
            )}
        </ModalFooter>
      </>
    )
  }

  // Nothing of theirs is missing from the room: either an empty library or a
  // room that already has all of it.
  if (library && library.candidateCount === 0) {
    const emptyLibrary = library.libraryCount === 0
    return (
      <>
        <ModalHeader title='One quick step' showClose={false} />
        <ModalBody className='space-y-3 text-sm text-muted-foreground'>
          {emptyLibrary
            ? (
              <p>
                You haven&apos;t added anything to Looksee yet — search for something you want to
                watch and it will land in {roomLabel}.
              </p>
            )
            : <p>Everything in your library is already in {roomLabel}. Nice.</p>}
          <p>
            Adding what you&apos;re into makes recommendations better and more fun for everyone.
          </p>
          {letterboxdOption}
        </ModalBody>
        <ModalFooter>
          <Button variant='secondary' className='flex-1' onClick={handleClose}>
            Not now
          </Button>
          <Button className='flex-1' onClick={() => router.push(`/add?roomId=${roomId}`)}>
            Search to add something
          </Button>
        </ModalFooter>
      </>
    )
  }

  if (phase.kind === 'manual') {
    const allShownPicked = shownTitles.length > 0 &&
      shownTitles.every((title) => pickedIds.includes(title.id))

    return (
      <>
        <ModalHeader
          title='Pick your titles'
          description={`Tick anything you want in ${roomLabel}.`}
          showClose={false}
        />
        <ModalBody className='space-y-3'>
          {errorBanner}
          <div className='relative'>
            <Search
              className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground'
              aria-hidden
            />
            <Input
              type='search'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search your library'
              aria-label='Search your library'
              className='pl-9'
            />
          </div>
          <div className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground'>
              {pickedIds.length} selected
            </span>
            <button
              type='button'
              className='min-h-[44px] font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50'
              disabled={shownTitles.length === 0}
              onClick={() =>
                setPickedIds((current) => {
                  const shownIds = shownTitles.map((title) => title.id)
                  if (allShownPicked) {
                    return current.filter((id) => !shownIds.includes(id))
                  }
                  return Array.from(new Set([...current, ...shownIds]))
                })}
            >
              {allShownPicked ? 'Clear these' : 'Select all'}
            </button>
          </div>
          {shownTitles.length === 0
            ? (
              <p className='py-6 text-center text-sm text-muted-foreground'>
                Nothing matches &ldquo;{query.trim()}&rdquo;.
              </p>
            )
            : (
              <ul className='space-y-1.5'>
                {shownTitles.map((title) => {
                  const picked = pickedIds.includes(title.id)
                  const year = title.releaseDate ? new Date(title.releaseDate).getFullYear() : null
                  return (
                    <li key={title.id}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-xl border p-2 transition-colors',
                          picked
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-background hover:bg-accent',
                        )}
                      >
                        <input
                          type='checkbox'
                          checked={picked}
                          onChange={() => togglePicked(title.id)}
                          className='sr-only'
                        />
                        <span
                          aria-hidden
                          className={cn(
                            'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors',
                            picked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input bg-background',
                          )}
                        >
                          {picked && <Check className='h-3.5 w-3.5' strokeWidth={3} />}
                        </span>
                        <PosterImage
                          src={title.posterUrl}
                          alt=''
                          width={32}
                          height={48}
                          className='h-12 w-8 flex-shrink-0 rounded object-cover'
                        />
                        <span className='min-w-0 flex-1'>
                          <span className='block truncate text-sm font-medium text-foreground'>
                            {title.title}
                          </span>
                          {year && (
                            <span className='block text-xs text-muted-foreground'>{year}</span>
                          )}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          {library?.truncated && (
            <p className='text-xs text-muted-foreground'>
              Showing your first {library.titles.length}{' '}
              titles. Add these, then use the groups for the rest.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant='secondary'
            className='flex-1'
            disabled={adding}
            onClick={() => {
              setError('')
              setPhase({ kind: 'choose' })
            }}
          >
            Back
          </Button>
          <Button
            className='flex-1'
            disabled={adding || pickedIds.length === 0}
            onClick={() => add({ mediaItemIds: pickedIds })}
          >
            {adding
              ? (
                <>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Adding…
                </>
              )
              : `Add ${formatTitleCount(pickedIds.length)}`}
          </Button>
        </ModalFooter>
      </>
    )
  }

  const addLabel = selectedCount === null ? 'Add them' : `Add ${formatTitleCount(selectedCount)}`

  return (
    <>
      <ModalHeader
        title='Add your titles'
        description={variant === 'created'
          ? 'Your new room is empty. Bring over what you already have in Looksee.'
          : `Bring what you already have in Looksee into ${roomLabel}.`}
        showClose={false}
      />
      <ModalBody className='space-y-4'>
        {errorBanner}
        <fieldset>
          <legend className='sr-only'>What to add</legend>
          <div className='space-y-2'>
            {groups.map((group) => {
              const selected = selectedGroups.includes(group.key)
              return (
                <label
                  key={group.key}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors',
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background hover:bg-accent',
                  )}
                >
                  <input
                    type='checkbox'
                    checked={selected}
                    onChange={() => toggleGroup(group.key)}
                    disabled={adding}
                    className='sr-only'
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors',
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-background',
                    )}
                  >
                    {selected && <Check className='h-3.5 w-3.5' strokeWidth={3} />}
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='block text-sm font-medium text-foreground'>
                      {group.label}
                    </span>
                    <span className='block text-xs text-muted-foreground'>
                      {group.description}
                    </span>
                  </span>
                  <span className='flex-shrink-0 text-sm tabular-nums text-muted-foreground'>
                    {library?.counts[group.key] ?? 0}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
        <button
          type='button'
          onClick={openManualPicker}
          disabled={adding}
          className='min-h-[44px] text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50'
        >
          Or pick them one by one
        </button>
        <p className='text-sm text-muted-foreground'>
          Nothing here changes your ratings — the titles just show up in {roomLabel} too.
        </p>
        {letterboxdOption}
      </ModalBody>
      <ModalFooter>
        <Button variant='secondary' className='flex-1' onClick={handleClose} disabled={adding}>
          Not now
        </Button>
        <Button
          className='flex-1'
          disabled={adding || selectedGroups.length === 0}
          onClick={() => add({ groups: selectedGroups })}
        >
          {adding
            ? (
              <>
                <Loader2 className='h-4 w-4 animate-spin' />
                Adding…
              </>
            )
            : addLabel}
        </Button>
      </ModalFooter>
    </>
  )
}
