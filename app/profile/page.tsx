'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { RoomJoinModal } from '@/components/RoomJoinModal'
import { AddYourTitlesModal } from '@/components/AddYourTitlesModal'
import { RoomMembersModal } from '@/components/RoomMembersModal'
import { ImportRoom, LetterboxdImportModal } from '@/components/LetterboxdImportModal'
import { NotificationSettings } from '@/components/NotificationSettings'
import { RenamedRoom, RenameRoomModal } from '@/components/RenameRoomModal'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import {
  pageContainerClassName,
  PageContent,
  PageHeader,
  PageHeaderBar,
} from '@/components/PageHeader'
import { SettingsCardSkeletonList } from '@/components/settings/SettingsCardSkeleton'
import { ImportSection } from '@/components/settings/ImportSection'
import { ProfileSection, ProfileUser } from '@/components/settings/ProfileSection'
import { RoomsSection } from '@/components/settings/RoomsSection'
import { SettingsRoom } from '@/components/settings/RoomCard'
import { SettingsCard, SettingsCardHeader } from '@/components/settings/SettingsCard'
import { InviteRoomModal } from '@/components/settings/InviteRoomModal'
import { ConfirmModal } from '@/components/settings/ConfirmModal'
import {
  CreatedRoomResult,
  CreateRoomModal,
  JoinedRoomResult,
  JoinRoomModal,
} from '@/components/settings/RoomFormModals'
import { notifyRoomsChanged, ROOMS_CHANGED_EVENT } from '@/lib/rooms'
import { cn } from '@/lib/utils'

type Tab = 'profile' | 'rooms'

type PendingConfirm =
  | { kind: 'delete'; room: SettingsRoom }
  | { kind: 'leave'; room: SettingsRoom }
  | { kind: 'signout' }

export default function ProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()

  const [user, setUser] = useState<ProfileUser | null>(null)
  const [rooms, setRooms] = useState<SettingsRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  const [inviteRoom, setInviteRoom] = useState<SettingsRoom | null>(null)
  const [membersRoom, setMembersRoom] = useState<SettingsRoom | null>(null)
  const [renamingRoom, setRenamingRoom] = useState<SettingsRoom | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Onboarding for a room just made or joined here: bring your titles over,
  // then (for a joined room that already has titles) the queue prompt.
  const [step, setStep] = useState<
    { room: ImportRoom; flow: 'created' | 'joined'; mediaCount: number } | null
  >(null)
  const [showTitlesPrompt, setShowTitlesPrompt] = useState(false)
  const [showRoomJoinModal, setShowRoomJoinModal] = useState(false)
  // Letterboxd import offered as part of that step; the Import card in the
  // Profile tab owns its own copy for the everyday case.
  const [letterboxdRoom, setLetterboxdRoom] = useState<ImportRoom | null>(null)
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms')
      if (!res.ok) return
      const data = await res.json()
      setRooms(data.rooms || [])
    } catch (err) {
      console.error('Failed to refresh rooms:', err)
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [userRes, roomsRes] = await Promise.all([
        fetch('/api/user/profile'),
        fetch('/api/rooms'),
      ])

      if (userRes.ok) {
        const userData = await userRes.json()
        setUser(userData.user)
      } else {
        setLoadError("Couldn't load your profile. Pull to refresh or try again later.")
      }

      if (roomsRes.ok) {
        const roomsData = await roomsRes.json()
        setRooms(roomsData.rooms || [])
      }
    } catch (err) {
      console.error('Failed to load profile data:', err)
      setLoadError("Couldn't load your profile. Pull to refresh or try again later.")
    } finally {
      setLoading(false)
    }
  }, [])

  // Load once per signed-in user. `update()` after a profile save flips the
  // session status through 'loading' again, which must not bounce the page
  // back to its Loading state.
  const sessionUserId = session?.user?.id ?? null
  const loadedForUserRef = useRef<string | null>(null)
  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated' || !sessionUserId) {
      router.push('/auth/signin')
      return
    }
    if (loadedForUserRef.current === sessionUserId) return
    loadedForUserRef.current = sessionUserId
    loadData()
  }, [sessionUserId, status, router, loadData])

  // Membership and counts change from other tabs/devices (someone joins with
  // our code, titles get added); refetch silently like RoomSelector does.
  useEffect(() => {
    if (!sessionUserId) return
    const refetch = () => refreshRooms()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshRooms()
    }
    window.addEventListener(ROOMS_CHANGED_EVENT, refetch)
    window.addEventListener('focus', refetch)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener(ROOMS_CHANGED_EVENT, refetch)
      window.removeEventListener('focus', refetch)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [sessionUserId, refreshRooms])

  useEffect(() => {
    return () => {
      if (promptTimerRef.current) clearTimeout(promptTimerRef.current)
    }
  }, [])

  const handleUserUpdated = async (updated: ProfileUser) => {
    setUser(updated)
    // Refresh the session so the name/avatar change shows up elsewhere.
    await update()
  }

  const handleRoomRenamed = (updated: RenamedRoom) => {
    setRooms((prev) => prev.map((r) => (r.id === updated.id ? { ...r, name: updated.name } : r)))
    notifyRoomsChanged()
  }

  // Let the form modal finish its close animation before the next step opens.
  const openTitlesPrompt = () => {
    if (promptTimerRef.current) clearTimeout(promptTimerRef.current)
    promptTimerRef.current = setTimeout(() => setShowTitlesPrompt(true), 220)
  }

  const handleJoined = async (result: JoinedRoomResult) => {
    await refreshRooms()
    notifyRoomsChanged()

    if (result.alreadyMember) return

    setStep({
      room: { id: result.room.id, name: result.room.name || '' },
      flow: 'joined',
      mediaCount: result.mediaItemCount,
    })
    openTitlesPrompt()
  }

  const handleCreated = async (result: CreatedRoomResult) => {
    await refreshRooms()
    notifyRoomsChanged()

    setStep({
      room: { id: result.room.id, name: result.room.name || '' },
      flow: 'created',
      mediaCount: 0,
    })
    openTitlesPrompt()
  }

  const handleTitlesPromptDone = () => {
    setShowTitlesPrompt(false)
    if (!step) return
    // A room made from Settings stays in Settings; a joined room that already
    // has titles goes on to the queue prompt.
    if (step.flow === 'created') return
    if (step.mediaCount > 0) {
      setShowRoomJoinModal(true)
      return
    }
    router.push(`/browse?roomId=${step.room.id}`)
  }

  const handleTitlesAdded = (added: number) => {
    // Patch locally instead of refetching so the modal keeps showing its result.
    setRooms((prev) =>
      prev.map((r) =>
        r.id === step?.room.id ? { ...r, mediaItemCount: r.mediaItemCount + added } : r
      )
    )
  }

  const handleImportLetterboxd = () => {
    if (!step) return
    setShowTitlesPrompt(false)
    setLetterboxdRoom(step.room)
  }

  const handleCloseLetterboxd = () => {
    setLetterboxdRoom(null)
    refreshRooms()
    // Resume the step the prompt would have led to.
    handleTitlesPromptDone()
  }

  const handleSkipQueue = () => {
    setShowRoomJoinModal(false)
    if (step) {
      router.push(`/browse?roomId=${step.room.id}`)
    }
  }

  const handleGoToQueue = () => {
    setShowRoomJoinModal(false)
    // Let the modal close before navigating.
    setTimeout(() => {
      router.push('/new')
    }, 100)
  }

  const deleteRoom = async (room: SettingsRoom): Promise<string | void> => {
    const res = await fetch(`/api/rooms/${room.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return data.error || 'Failed to delete room'
    }
    setRooms((prev) => prev.filter((r) => r.id !== room.id))
    notifyRoomsChanged()
  }

  const leaveRoom = async (room: SettingsRoom): Promise<string | void> => {
    const res = await fetch(`/api/rooms/${room.id}/leave`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return data.error || 'Failed to leave room'
    }
    setRooms((prev) => prev.filter((r) => r.id !== room.id))
    notifyRoomsChanged()
  }

  const handleConfirm = async (): Promise<string | void> => {
    if (!pendingConfirm) return
    switch (pendingConfirm.kind) {
      case 'delete':
        return deleteRoom(pendingConfirm.room)
      case 'leave':
        return leaveRoom(pendingConfirm.room)
      case 'signout':
        await signOut({ callbackUrl: '/auth/signin' })
        return
    }
  }

  const confirmCopy = (() => {
    if (!pendingConfirm) return null
    switch (pendingConfirm.kind) {
      case 'delete':
        return {
          title: `Delete ${pendingConfirm.room.name}?`,
          description: (
            <>
              <p>
                This removes the room for everyone in it. Titles and ratings stay in each
                person&apos;s own library and any other rooms.
              </p>
              <p>This can&apos;t be undone.</p>
            </>
          ),
          confirmLabel: 'Delete room',
          busyLabel: 'Deleting…',
          destructive: true,
        }
      case 'leave':
        return {
          title: `Leave ${pendingConfirm.room.name}?`,
          description: (
            <p>
              You&apos;ll stop seeing this room&apos;s titles and recommendations. You can rejoin
              later with the invite code.
            </p>
          ),
          confirmLabel: 'Leave room',
          busyLabel: 'Leaving…',
          destructive: true,
        }
      case 'signout':
        return {
          title: 'Sign out?',
          description: <p>You can sign back in any time with your email and password.</p>,
          confirmLabel: 'Sign out',
          busyLabel: 'Signing out…',
          destructive: false,
        }
    }
  })()

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'rooms', label: rooms.length > 0 ? `Rooms (${rooms.length})` : 'Rooms' },
  ]

  return (
    <div className={pageContainerClassName}>
      <PageHeaderBar className='pb-0'>
        <PageHeader title='Settings' subtitle='Your profile and rooms.' className='mb-2' />
        <div role='tablist' aria-label='Settings sections' className='-mb-px flex gap-1'>
          {tabs.map((tab) => {
            const selected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role='tab'
                type='button'
                id={`settings-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`settings-panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'min-h-[44px] border-b-2 px-4 text-sm font-medium transition-colors',
                  selected
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </PageHeaderBar>

      <PageContent className='bottom-nav-spacing min-h-[calc(100vh-200px)]'>
        {loading ? <SettingsCardSkeletonList /> : (
          <>
            <div
              role='tabpanel'
              id='settings-panel-profile'
              aria-labelledby='settings-tab-profile'
              hidden={activeTab !== 'profile'}
              className='space-y-4'
            >
              {loadError && <Notice variant='error'>{loadError}</Notice>}
              {user && <ProfileSection user={user} onUserUpdated={handleUserUpdated} />}

              <NotificationSettings />

              <ImportSection
                rooms={rooms.map((room) => ({ id: room.id, name: room.name }))}
                onImported={refreshRooms}
              />

              <SettingsCard>
                <SettingsCardHeader
                  title='Account'
                  description={user ? `Signed in as ${user.email}` : undefined}
                  className='mb-3'
                />
                <Button
                  type='button'
                  variant='outline-destructive'
                  onClick={() => setPendingConfirm({ kind: 'signout' })}
                  className='w-full'
                >
                  <LogOut className='h-4 w-4' />
                  Sign out
                </Button>
              </SettingsCard>
            </div>

            <div
              role='tabpanel'
              id='settings-panel-rooms'
              aria-labelledby='settings-tab-rooms'
              hidden={activeTab !== 'rooms'}
            >
              <RoomsSection
                rooms={rooms}
                onCreate={() => setShowCreateModal(true)}
                onJoin={() => setShowJoinModal(true)}
                onOpen={(room) => router.push(`/browse?roomId=${room.id}`)}
                onInvite={setInviteRoom}
                onMembers={setMembersRoom}
                onRename={setRenamingRoom}
                onLeave={(room) => setPendingConfirm({ kind: 'leave', room })}
                onDelete={(room) => setPendingConfirm({ kind: 'delete', room })}
              />
            </div>
          </>
        )}
      </PageContent>

      <InviteRoomModal room={inviteRoom} onClose={() => setInviteRoom(null)} />

      <RoomMembersModal
        isOpen={membersRoom !== null}
        onClose={() => setMembersRoom(null)}
        roomId={membersRoom?.id ?? null}
        roomName={membersRoom?.name ?? ''}
        onMembersChanged={() => {
          refreshRooms()
          notifyRoomsChanged()
        }}
      />

      <RenameRoomModal
        room={renamingRoom}
        onClose={() => setRenamingRoom(null)}
        onRenamed={handleRoomRenamed}
      />

      <ConfirmModal
        open={confirmCopy !== null}
        title={confirmCopy?.title ?? ''}
        description={confirmCopy?.description}
        confirmLabel={confirmCopy?.confirmLabel ?? ''}
        busyLabel={confirmCopy?.busyLabel}
        destructive={confirmCopy?.destructive}
        onConfirm={handleConfirm}
        onClose={() => setPendingConfirm(null)}
      />

      <JoinRoomModal
        open={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoined={handleJoined}
      />

      <CreateRoomModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
      />

      {showRoomJoinModal && (
        <RoomJoinModal
          isOpen
          mediaCount={step?.mediaCount ?? 0}
          roomId={step?.room.id ?? ''}
          onSkip={handleSkipQueue}
          onGoToQueue={handleGoToQueue}
        />
      )}

      <AddYourTitlesModal
        isOpen={showTitlesPrompt}
        roomId={step?.room.id ?? null}
        roomName={step?.room.name}
        variant={step?.flow ?? 'joined'}
        onDismiss={handleTitlesPromptDone}
        onAdded={handleTitlesAdded}
        onImportLetterboxd={handleImportLetterboxd}
      />

      <LetterboxdImportModal
        isOpen={letterboxdRoom !== null}
        onClose={handleCloseLetterboxd}
        rooms={letterboxdRoom ? [letterboxdRoom] : []}
        defaultRoomId={letterboxdRoom?.id ?? null}
        lockRoom
      />
    </div>
  )
}
