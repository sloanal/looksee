'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Modal, ModalBody, ModalFooter, ModalHeader, useModal } from '@/components/ui/modal'
import { Notice } from '@/components/ui/notice'
import { Select } from '@/components/ui/select'
import {
  LETTERBOXD_BATCH_SIZE,
  LETTERBOXD_MAX_FILE_BYTES,
  LETTERBOXD_MAX_ROWS,
  LetterboxdRow,
  parseLetterboxdCsv,
} from '@/lib/letterboxd'
import { formatTitleCount, notifyRoomsChanged } from '@/lib/rooms'
import { clientSubmissionContext } from '@/lib/submission-context'

export type ImportRoom = { id: string; name: string }

interface LetterboxdImportModalProps {
  isOpen: boolean
  onClose: () => void
  /** Rooms the films may go into. Empty means the personal library only. */
  rooms?: ImportRoom[]
  /** Preselected destination; null is the personal library ("My Stuff"). */
  defaultRoomId?: string | null
  /** Fix the destination and hide the picker (onboarding, right after a room is made). */
  lockRoom?: boolean
  onImported?: (result: { added: number; roomId: string | null }) => void
}

/**
 * Bulk import from a Letterboxd CSV export. Letterboxd has no public API for a
 * member's lists, so the file is the only way in; it is parsed in the browser
 * and sent to POST /api/import/letterboxd in batches so a long watchlist shows
 * progress instead of one long stall.
 */
export function LetterboxdImportModal({
  isOpen,
  onClose,
  rooms = [],
  defaultRoomId = null,
  lockRoom = false,
  onImported,
}: LetterboxdImportModalProps) {
  // An import runs batch by batch from this component, so the dialog stays put
  // until it finishes rather than leaving a half-imported watchlist behind.
  const [importing, setImporting] = useState(false)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dismissible={!importing}
      aria-label='Import from Letterboxd'
    >
      {isOpen && (
        <ImportBody
          rooms={rooms}
          defaultRoomId={defaultRoomId}
          lockRoom={lockRoom}
          onImported={onImported}
          onImportingChange={setImporting}
        />
      )}
    </Modal>
  )
}

type ParsedFile = {
  fileName: string
  rows: LetterboxdRow[]
  rated: boolean
  truncated: number
}

type Totals = {
  added: number
  addedToRoom: number
  seen: number
  alreadyThere: number
  unmatched: string[]
}

type Phase =
  | { kind: 'pick' }
  | { kind: 'ready'; file: ParsedFile }
  | { kind: 'importing'; file: ParsedFile; done: number }
  | { kind: 'done'; totals: Totals; roomId: string | null }

const emptyTotals = (): Totals => ({
  added: 0,
  addedToRoom: 0,
  seen: 0,
  alreadyThere: 0,
  unmatched: [],
})

const UNMATCHED_SHOWN = 5

function ImportBody({
  rooms,
  defaultRoomId,
  lockRoom,
  onImported,
  onImportingChange,
}: Omit<LetterboxdImportModalProps, 'isOpen' | 'onClose'> & {
  rooms: ImportRoom[]
  onImportingChange: (importing: boolean) => void
}) {
  const router = useRouter()
  const { handleClose } = useModal()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [roomId, setRoomId] = useState<string | null>(
    defaultRoomId && rooms.some((room) => room.id === defaultRoomId) ? defaultRoomId : null,
  )
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' })
  const [error, setError] = useState('')

  const roomName = rooms.find((room) => room.id === roomId)?.name ?? null
  const destination = roomName ?? 'My Stuff'

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    if (file.size > LETTERBOXD_MAX_FILE_BYTES) {
      setError('That file is too big to be a Letterboxd export.')
      return
    }

    const text = await file.text().catch(() => null)
    if (text === null) {
      setError("Couldn't read that file. Please try again.")
      return
    }

    const parsed = parseLetterboxdCsv(text)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    setPhase({
      kind: 'ready',
      file: {
        fileName: file.name,
        rows: parsed.rows,
        rated: parsed.rated,
        truncated: parsed.truncated,
      },
    })
  }

  const runImport = async (file: ParsedFile) => {
    setError('')
    setPhase({ kind: 'importing', file, done: 0 })
    onImportingChange(true)

    const totals = emptyTotals()
    const context = clientSubmissionContext()

    const fail = (message: string) => {
      // Importing is idempotent, so retrying only picks up what is left.
      setError(message)
      setPhase({ kind: 'ready', file })
      onImportingChange(false)
    }

    for (let start = 0; start < file.rows.length; start += LETTERBOXD_BATCH_SIZE) {
      const batch = file.rows.slice(start, start + LETTERBOXD_BATCH_SIZE)
      try {
        const res = await fetch('/api/import/letterboxd', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...context, roomId, items: batch }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          fail(data.error || "Couldn't finish the import. Try again to pick up where it left off.")
          return
        }
        totals.added += Number(data.added) || 0
        totals.addedToRoom += Number(data.addedToRoom) || 0
        totals.seen += Number(data.seen) || 0
        totals.alreadyThere += Number(data.alreadyThere) || 0
        if (Array.isArray(data.unmatched)) totals.unmatched.push(...data.unmatched)
      } catch (err) {
        console.error('Failed to import from Letterboxd:', err)
        fail("Couldn't finish the import. Try again to pick up where it left off.")
        return
      }
      setPhase({ kind: 'importing', file, done: Math.min(start + batch.length, file.rows.length) })
    }

    notifyRoomsChanged()
    onImported?.({ added: totals.added, roomId })
    setPhase({ kind: 'done', totals, roomId })
    onImportingChange(false)
  }

  const errorBanner = error ? <Notice variant='error'>{error}</Notice> : null

  if (phase.kind === 'done') {
    const { totals } = phase
    // Rated films never enter a room, so the room is only the whole story when
    // every film that came in also got a room join.
    const roomTarget = phase.roomId !== null ? destination : null
    const allWentToRoom = roomTarget !== null && totals.addedToRoom === totals.added

    // Built as strings so no line wrap can slip a space before a colon or period.
    const headline = totals.added > 0
      ? `Added ${formatTitleCount(totals.added)} to ${allWentToRoom ? roomTarget : 'your library'}.`
      : 'Everything in that export was already here.'
    const roomNote = roomTarget && !allWentToRoom && totals.addedToRoom > 0
      ? `${formatTitleCount(totals.addedToRoom)} of them are in ${roomTarget} for everyone to see.`
      : null
    const seenNote = roomTarget && totals.seen > 0
      ? `${
        formatTitleCount(totals.seen)
      } you had already rated stayed in My Stuff instead of the room, so nobody else has to rate your watch history.`
      : null
    const unmatchedNote = totals.unmatched.length > 0
      ? `Couldn't find ${
        totals.unmatched.length === 1 ? '1 film' : `${totals.unmatched.length} films`
      }: ${
        [
          ...totals.unmatched.slice(0, UNMATCHED_SHOWN),
          ...(totals.unmatched.length > UNMATCHED_SHOWN
            ? [`and ${totals.unmatched.length - UNMATCHED_SHOWN} more`]
            : []),
        ].join(', ')
      }. You can search for those on the Add tab.`
      : null

    return (
      <>
        <ModalHeader title={totals.added > 0 ? 'Imported' : 'Nothing new to add'} />
        <ModalBody className='space-y-3 text-sm text-muted-foreground'>
          <p>{headline}</p>
          {roomNote && <p>{roomNote}</p>}
          {seenNote && <p>{seenNote}</p>}
          {totals.alreadyThere > 0 && totals.added > 0 && (
            <p>{formatTitleCount(totals.alreadyThere)} were already here.</p>
          )}
          {unmatchedNote && <p>{unmatchedNote}</p>}
          {roomTarget && totals.addedToRoom > 0 && (
            <p>
              Set how excited you are about each one and they&apos;ll start showing up in Watch.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant='secondary' className='flex-1' onClick={handleClose}>
            Done
          </Button>
          {phase.roomId !== null && totals.addedToRoom > 0
            ? (
              <Button className='flex-1' onClick={() => router.push('/new')}>
                Rate them now
              </Button>
            )
            : (
              <Button
                className='flex-1'
                onClick={() =>
                  router.push(phase.roomId ? `/browse?roomId=${phase.roomId}` : '/browse')}
              >
                See them
              </Button>
            )}
        </ModalFooter>
      </>
    )
  }

  if (phase.kind === 'importing') {
    const total = phase.file.rows.length
    const percent = total === 0 ? 0 : Math.round((phase.done / total) * 100)
    return (
      <>
        <ModalHeader title='Importing' showClose={false} />
        <ModalBody className='space-y-3 text-sm text-muted-foreground'>
          <p>
            Looking up {formatTitleCount(total)} and adding them to{' '}
            {destination}. This can take a minute — keep this window open.
          </p>
          <div
            className='h-2 w-full overflow-hidden rounded-full bg-secondary'
            role='progressbar'
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={phase.done}
          >
            <div
              className='h-full rounded-full bg-primary transition-[width] duration-300'
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className='tabular-nums'>
            {phase.done} of {total}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button className='flex-1' disabled>
            <Loader2 className='h-4 w-4 animate-spin' />
            Importing…
          </Button>
        </ModalFooter>
      </>
    )
  }

  const destinationField = !lockRoom && rooms.length > 0 && (
    <Field label='Add to' htmlFor='letterboxd-destination'>
      <Select
        id='letterboxd-destination'
        value={roomId ?? ''}
        onChange={(e) =>
          setRoomId(e.target.value || null)}
      >
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {room.name}
          </option>
        ))}
        <option value=''>My Stuff (just me)</option>
      </Select>
    </Field>
  )

  const fileInput = (
    <input
      ref={fileInputRef}
      type='file'
      accept='.csv,text/csv'
      className='hidden'
      onChange={(e) => {
        handleFile(e.target.files?.[0])
        // Let the same file be picked again after an error.
        e.target.value = ''
      }}
    />
  )

  if (phase.kind === 'ready') {
    const { file } = phase
    return (
      <>
        <ModalHeader
          title='Import from Letterboxd'
          description={`Found ${formatTitleCount(file.rows.length)} in ${file.fileName}.`}
        />
        <ModalBody className='space-y-4'>
          {errorBanner}
          {destinationField}
          <div className='space-y-2 text-sm text-muted-foreground'>
            {file.truncated > 0 && (
              <p>
                That export has more than {LETTERBOXD_MAX_ROWS} films, so the {LETTERBOXD_MAX_ROWS}
                {' '}
                you added most recently will come in.
              </p>
            )}
            {file.rated
              ? (
                <p>
                  Films you rated come in as already seen, with your stars mapped onto
                  Looksee&apos;s excitement. Everything else comes in as not seen yet, ready to
                  rate.
                </p>
              )
              : (
                <p>
                  They come in as films you haven&apos;t seen yet, waiting on how excited you are —
                  you can set that in the queue afterwards.
                </p>
              )}
            <p>Ratings you have already made in Looksee are never overwritten.</p>
          </div>
          {fileInput}
        </ModalBody>
        <ModalFooter>
          <Button
            variant='outline'
            className='flex-1'
            onClick={() => fileInputRef.current?.click()}
          >
            Pick another file
          </Button>
          <Button className='flex-1' onClick={() => runImport(file)}>
            Add {formatTitleCount(file.rows.length)}
          </Button>
        </ModalFooter>
      </>
    )
  }

  return (
    <>
      <ModalHeader
        title='Import from Letterboxd'
        description={lockRoom && roomName
          ? `Bring your Letterboxd watchlist into ${roomName}.`
          : 'Bring your Letterboxd watchlist into Looksee.'}
      />
      <ModalBody className='space-y-4'>
        {errorBanner}
        <ol className='list-decimal space-y-2 pl-5 text-sm text-muted-foreground'>
          <li>
            On Letterboxd, open{' '}
            <a
              href='https://letterboxd.com/settings/data/'
              target='_blank'
              rel='noreferrer'
              className='font-medium text-primary underline-offset-4 hover:underline'
            >
              Settings → Data
            </a>{' '}
            and choose Export your data.
          </li>
          <li>
            Unzip the download and pick <span className='font-medium'>watchlist.csv</span> below.
          </li>
        </ol>
        {destinationField}
        {fileInput}
      </ModalBody>
      <ModalFooter>
        <Button variant='secondary' className='flex-1' onClick={handleClose}>
          Not now
        </Button>
        <Button className='flex-1' onClick={() => fileInputRef.current?.click()}>
          <Upload className='h-4 w-4' />
          Choose CSV
        </Button>
      </ModalFooter>
    </>
  )
}
