'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal, ModalBody, ModalFooter, ModalHeader, useModal } from '@/components/ui/modal'
import { Notice } from '@/components/ui/notice'
import { EXCITEMENT_OPTIONS, RatingFields } from '@/components/RatingFields'
import {
  LETTERBOXD_BATCH_SIZE,
  LETTERBOXD_IMPORT_DEFAULTS,
  LETTERBOXD_MAX_FILE_BYTES,
  LETTERBOXD_MAX_ROWS,
  LetterboxdRow,
  parseLetterboxdCsv,
} from '@/lib/letterboxd'
import { formatTitleCount, notifyRoomsChanged } from '@/lib/rooms'
import { clientSubmissionContext } from '@/lib/submission-context'
import { cn } from '@/lib/utils'

export type ImportRoom = { id: string; name: string }

interface LetterboxdImportModalProps {
  isOpen: boolean
  onClose: () => void
  /** Rooms the films may be shared with. Empty means the personal library only. */
  rooms?: ImportRoom[]
  /** Preselected room; null shares with nobody. */
  defaultRoomId?: string | null
  /** Fix the destination and hide the picker (onboarding, right after a room is made). */
  lockRoom?: boolean
  onImported?: (result: { added: number; roomIds: string[] }) => void
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
  /** `rooms` is the selection the import actually ran with. */
  | { kind: 'done'; totals: Totals; rooms: ImportRoom[] }

const emptyTotals = (): Totals => ({
  added: 0,
  addedToRoom: 0,
  seen: 0,
  alreadyThere: 0,
  unmatched: [],
})

const UNMATCHED_SHOWN = 5

const DEFAULT_STATUS = LETTERBOXD_IMPORT_DEFAULTS.status.toLowerCase()

/** "Movie Night", "Movie Night and Sunday Club", "A, B and C". */
function joinNames(names: string[]): string {
  if (names.length < 2) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

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

  const [roomIds, setRoomIds] = useState<string[]>(
    defaultRoomId && rooms.some((room) => room.id === defaultRoomId) ? [defaultRoomId] : [],
  )
  // How the films should land. The export only has an opinion about rows that
  // carry stars; these fill in everything else.
  const [status, setStatus] = useState(DEFAULT_STATUS)
  const [excitement, setExcitement] = useState<number>(LETTERBOXD_IMPORT_DEFAULTS.excitement)
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' })
  const [error, setError] = useState('')

  const selectedRooms = rooms.filter((room) => roomIds.includes(room.id))
  const roomNames = joinNames(selectedRooms.map((room) => room.name))
  const destination = roomNames || 'My Stuff'
  const markSeen = status === 'already_seen'

  const toggleRoom = (roomId: string) =>
    setRoomIds((current) =>
      current.includes(roomId) ? current.filter((id) => id !== roomId) : [...current, roomId]
    )

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
    const importedInto = selectedRooms

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
          body: JSON.stringify({
            ...context,
            roomIds,
            defaults: { status, excitement },
            items: batch,
          }),
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
    onImported?.({ added: totals.added, roomIds })
    setPhase({ kind: 'done', totals, rooms: importedInto })
    onImportingChange(false)
  }

  const errorBanner = error ? <Notice variant='error'>{error}</Notice> : null

  if (phase.kind === 'done') {
    const { totals } = phase
    // Films the caller has already seen never enter a room, so the rooms are
    // only the whole story when every film that came in also got a room join.
    const roomTarget = phase.rooms.length > 0
      ? joinNames(phase.rooms.map((room) => room.name))
      : null
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
      } came in as already seen, so they stayed in My Stuff instead of ${roomTarget} — nobody else has to rate your watch history.`
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

    const firstRoomId = phase.rooms[0]?.id ?? null

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
          {totals.added > 0 && (
            <p>
              They are all rated, so nothing is waiting on you in New. Change any of them from
              Browse.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant='secondary' className='flex-1' onClick={handleClose}>
            Done
          </Button>
          <Button
            className='flex-1'
            onClick={() => router.push(firstRoomId ? `/browse?roomId=${firstRoomId}` : '/browse')}
          >
            See them
          </Button>
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
            {markSeen ? 'My Stuff' : destination}. This can take a minute — keep this window open.
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
    const excitementOption = EXCITEMENT_OPTIONS.find((option) => option.value === excitement)
    const excitementWord = (excitementOption?.label ?? 'neutral').toLowerCase()

    const landingNote = markSeen
      ? `They come in as films you have already seen, marked ${excitementWord}.`
      : `They come in as films you haven't seen yet, marked ${excitementWord}, so Watch can rank them straight away.`
    const roomNote = selectedRooms.length === 0
      ? null
      : markSeen
      ? `Nothing will go into ${roomNames}: films you have already seen stay in My Stuff, so nobody else has to rate your watch history.`
      : file.rated
      ? `Everything but your rated films will show up in ${roomNames} too.`
      : `They will show up in ${roomNames} too.`

    return (
      <>
        <ModalHeader
          title='Import from Letterboxd'
          description={`Found ${formatTitleCount(file.rows.length)} in ${file.fileName}.`}
        />
        <ModalBody className='space-y-4'>
          {errorBanner}
          {!lockRoom && rooms.length > 0 && (
            <fieldset>
              <legend className='mb-2 block text-sm font-medium text-foreground'>Share with</legend>
              <div className='space-y-2'>
                {rooms.map((room) => {
                  const isSelected = roomIds.includes(room.id)
                  return (
                    <label
                      key={room.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-background hover:bg-accent',
                      )}
                    >
                      <input
                        type='checkbox'
                        checked={isSelected}
                        onChange={() => toggleRoom(room.id)}
                        className='sr-only'
                      />
                      <span
                        aria-hidden
                        className={cn(
                          'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input bg-background',
                        )}
                      >
                        {isSelected && <Check className='h-3.5 w-3.5' strokeWidth={3} />}
                      </span>
                      <span className='min-w-0 flex-1 truncate font-medium text-foreground'>
                        {room.name}
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className='mt-1.5 text-xs text-muted-foreground'>
                They always land in My Stuff. Pick any rooms to share them with too.
              </p>
            </fieldset>
          )}
          <RatingFields
            status={status}
            excitement={excitement}
            onStatusChange={setStatus}
            onExcitementChange={setExcitement}
            statusLegend='Bring them in as'
            excitementLegend='How excited are you?'
          />
          <div className='space-y-2 text-sm text-muted-foreground'>
            {file.truncated > 0 && (
              <p>
                That export has more than {LETTERBOXD_MAX_ROWS} films, so the {LETTERBOXD_MAX_ROWS}
                {' '}
                you added most recently will come in.
              </p>
            )}
            <p>{landingNote}</p>
            {roomNote && <p>{roomNote}</p>}
            {file.rated && (
              <p>
                Films you gave stars on Letterboxd keep them instead: those come in as already seen,
                with the stars mapped onto Looksee&apos;s excitement.
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
        description={lockRoom && roomNames
          ? `Bring your Letterboxd watchlist into ${roomNames}.`
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
          <li>Choose where the films go and how they come in, then import.</li>
        </ol>
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
