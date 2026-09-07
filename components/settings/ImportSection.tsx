'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsCard, SettingsCardHeader } from '@/components/settings/SettingsCard'
import { ImportRoom, LetterboxdImportModal } from '@/components/LetterboxdImportModal'

interface ImportSectionProps {
  rooms: ImportRoom[]
  onImported?: () => void
}

export function ImportSection({ rooms, onImported }: ImportSectionProps) {
  const [open, setOpen] = useState(false)

  return (
    <SettingsCard>
      <SettingsCardHeader
        icon={Download}
        title='Import from Letterboxd'
        description='Bring your Letterboxd watchlist in, and choose how excited you are and which rooms get them.'
      />
      <Button
        type='button'
        variant='outline'
        onClick={() => setOpen(true)}
        className='w-full sm:w-auto'
      >
        Import watchlist
      </Button>

      <LetterboxdImportModal
        isOpen={open}
        onClose={() => setOpen(false)}
        rooms={rooms}
        defaultRoomId={rooms[0]?.id ?? null}
        onImported={onImported}
      />
    </SettingsCard>
  )
}
