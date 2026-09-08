'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { KeyRound, Sofa } from 'lucide-react'
import { RoomJoinModal } from '@/components/RoomJoinModal'
import { AddYourTitlesModal } from '@/components/AddYourTitlesModal'
import { ImportRoom, LetterboxdImportModal } from '@/components/LetterboxdImportModal'
import { AuthShell } from '@/components/AuthShell'
import { Button } from '@/components/ui/button'
import { ChoiceCard } from '@/components/ui/choice-card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'

export default function RoomSetupPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [mode, setMode] = useState<'create' | 'join' | null>(null)
  const [roomName, setRoomName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // The room this setup just landed on, and how it got there: a room they made
  // continues into the rating queue, a joined room into the join prompts.
  const [step, setStep] = useState<
    { room: ImportRoom; flow: 'created' | 'joined'; mediaCount: number } | null
  >(null)
  const [showTitlesPrompt, setShowTitlesPrompt] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showLetterboxd, setShowLetterboxd] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
    }
  }, [session, status, router])

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create room')
        return
      }

      // A brand new room is empty, so offer their library before rating.
      setStep({
        room: { id: data.room.id, name: data.room.name || roomName.trim() },
        flow: 'created',
        mediaCount: 0,
      })
      setShowTitlesPrompt(true)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.toUpperCase() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to join room')
        return
      }

      // If already a member, redirect directly
      if (data.alreadyMember) {
        router.push(`/browse?roomId=${data.room.id}`)
        return
      }

      // First step: offer to bring their own titles into the room.
      setStep({
        room: { id: data.room.id, name: data.room.name || '' },
        flow: 'joined',
        mediaCount: data.mediaItemCount,
      })
      setShowTitlesPrompt(true)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleTitlesPromptDone = () => {
    setShowTitlesPrompt(false)
    if (!step) return
    // A room they made goes on to rate whatever landed in it; a joined room
    // with titles already in it goes on to the queue prompt.
    if (step.flow === 'created') {
      router.push(`/onboarding?roomId=${step.room.id}`)
      return
    }
    if (step.mediaCount > 0) {
      setShowJoinModal(true)
      return
    }
    router.push(`/browse?roomId=${step.room.id}`)
  }

  const handleImportLetterboxd = () => {
    if (!step) return
    setShowTitlesPrompt(false)
    setShowLetterboxd(true)
  }

  const handleCloseLetterboxd = () => {
    setShowLetterboxd(false)
    // Resume the step the titles prompt would have led to.
    handleTitlesPromptDone()
  }

  const handleSkipQueue = () => {
    setShowJoinModal(false)
    if (step) {
      router.push(`/browse?roomId=${step.room.id}`)
    }
  }

  const handleGoToQueue = () => {
    setShowJoinModal(false)
    // Use setTimeout to ensure modal closes before navigation
    setTimeout(() => {
      router.push('/new')
    }, 100)
  }

  if (!session) {
    return null
  }

  // Shared by both branches below: the same prompts follow a room whether it
  // was made here or joined here.
  const roomModals = (
    <>
      <AddYourTitlesModal
        isOpen={showTitlesPrompt}
        roomId={step?.room.id ?? null}
        roomName={step?.room.name}
        variant={step?.flow ?? 'joined'}
        onDismiss={handleTitlesPromptDone}
        onImportLetterboxd={handleImportLetterboxd}
      />
      <LetterboxdImportModal
        isOpen={showLetterboxd}
        onClose={handleCloseLetterboxd}
        rooms={step ? [step.room] : []}
        defaultRoomId={step?.room.id ?? null}
        lockRoom
      />
    </>
  )

  if (mode === null) {
    return (
      <div className='flex min-h-[100dvh] flex-col items-center justify-center bg-canvas px-4 py-8 safe-bottom'>
        <div className='w-full max-w-md'>
          <div className='mb-6 text-center'>
            <h1 className='text-3xl font-bold tracking-tight text-foreground'>
              Welcome to Looksee
            </h1>
            <p className='mt-2 text-sm text-muted-foreground' style={{ textWrap: 'balance' }}>
              Add movies and shows you like to rooms you share with others. Looksee will help you
              find things you all want to watch.
            </p>
          </div>

          <div className='space-y-3'>
            <ChoiceCard
              icon={Sofa}
              title='Create a room'
              description='Add movies and shows and invite others later'
              primary
              onClick={() => setMode('create')}
            />
            <ChoiceCard
              icon={KeyRound}
              title='Join a room'
              description='Enter an invite code'
              onClick={() => setMode('join')}
            />
            <ChoiceCard
              title='Skip for now'
              description='Just add some things for yourself'
              subtle
              onClick={() => router.push('/add')}
            />
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'create') {
    return (
      <>
        <AuthShell title='Create a room' description='Give your room a name.'>
          <form onSubmit={handleCreateRoom} className='space-y-4'>
            {error && <Notice variant='error'>{error}</Notice>}

            <Field label='Room name' htmlFor='roomName'>
              <Input
                id='roomName'
                type='text'
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
                placeholder='e.g., Our Apartment'
              />
            </Field>

            <div className='flex gap-3'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setMode(null)}
                className='flex-1'
              >
                Back
              </Button>
              <Button type='submit' disabled={loading} className='flex-1'>
                {loading ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </AuthShell>

        {roomModals}
      </>
    )
  }

  return (
    <>
      <AuthShell title='Join a room' description='Enter the invite code.'>
        <form onSubmit={handleJoinRoom} className='space-y-4'>
          {error && <Notice variant='error'>{error}</Notice>}

          <Field label='Invite code' htmlFor='inviteCode'>
            <Input
              id='inviteCode'
              type='text'
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              required
              maxLength={6}
              className='h-14 text-center font-mono text-2xl uppercase tracking-[0.3em] sm:text-2xl'
              placeholder='ABC123'
            />
          </Field>

          <div className='flex gap-3'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setMode(null)}
              className='flex-1'
            >
              Back
            </Button>
            <Button type='submit' disabled={loading} className='flex-1'>
              {loading ? 'Joining...' : 'Join'}
            </Button>
          </div>
        </form>
      </AuthShell>

      <RoomJoinModal
        isOpen={showJoinModal}
        mediaCount={step?.mediaCount ?? 0}
        roomId={step?.room.id ?? ''}
        onSkip={handleSkipQueue}
        onGoToQueue={handleGoToQueue}
      />

      {roomModals}
    </>
  )
}
