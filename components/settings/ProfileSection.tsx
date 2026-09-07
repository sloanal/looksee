'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Loader2, Trash2, UserRound } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ErrorText, Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SettingsCard, SettingsCardHeader } from '@/components/settings/SettingsCard'
import { cn } from '@/lib/utils'

export interface ProfileUser {
  id: string
  name: string
  email: string
  imageUrl?: string | null
}

interface ProfileSectionProps {
  user: ProfileUser
  /** Called with the server's copy of the user after any successful save. */
  onUserUpdated: (user: ProfileUser) => Promise<void> | void
}

export function ProfileSection({ user, onUserUpdated }: ProfileSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(user.name)
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [removingPhoto, setRemovingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')

  useEffect(() => {
    setName(user.name)
  }, [user.name])

  useEffect(() => {
    if (!nameSaved) return
    const timer = setTimeout(() => setNameSaved(false), 2500)
    return () => clearTimeout(timer)
  }, [nameSaved])

  const trimmedName = name.trim()
  const nameDirty = trimmedName !== user.name
  const canSaveName = nameDirty && trimmedName.length > 0 && !savingName
  const photoBusy = uploading || removingPhoto

  const patchProfile = async (
    body: { name?: string; imageUrl?: string | null },
  ): Promise<{ user?: ProfileUser; error?: string }> => {
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let data: { user?: ProfileUser; error?: string } = {}
    try {
      data = JSON.parse(text)
    } catch {
      // Non-JSON body (e.g. a proxy error page); fall through to defaults.
    }
    if (!res.ok) {
      return { error: data.error || 'Failed to update profile' }
    }
    return data
  }

  const handleSaveName = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!canSaveName) return
    setSavingName(true)
    setNameError('')
    try {
      const result = await patchProfile({ name: trimmedName })
      if (result.error || !result.user) {
        setNameError(result.error || 'Failed to update profile')
        return
      }
      await onUserUpdated(result.user)
      setNameSaved(true)
    } catch (err) {
      console.error('Failed to save profile:', err)
      setNameError('Failed to update profile')
    } finally {
      setSavingName(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset so picking the same file again re-triggers onChange.
    e.target.value = ''
    if (!file) return

    setUploading(true)
    setPhotoError('')
    try {
      const croppedFile = await cropImageToSquare(file)
      const formData = new FormData()
      formData.append('file', croppedFile)

      const res = await fetch('/api/user/upload', { method: 'POST', body: formData })
      const text = await res.text()
      let data: { imageUrl?: string; error?: string } = {}
      try {
        data = JSON.parse(text)
      } catch {
        // Non-JSON body; fall through to the default message.
      }
      if (!res.ok || !data.imageUrl) {
        setPhotoError(data.error || 'Failed to upload image')
        return
      }

      const result = await patchProfile({ imageUrl: data.imageUrl })
      if (result.error || !result.user) {
        setPhotoError(result.error || 'Failed to update profile')
        return
      }
      await onUserUpdated(result.user)
    } catch (err) {
      console.error('Failed to upload file:', err)
      setPhotoError('Failed to process or upload image')
    } finally {
      setUploading(false)
    }
  }

  const handleRemovePhoto = async () => {
    setRemovingPhoto(true)
    setPhotoError('')
    try {
      const result = await patchProfile({ imageUrl: null })
      if (result.error || !result.user) {
        setPhotoError(result.error || 'Failed to remove photo')
        return
      }
      await onUserUpdated(result.user)
    } catch (err) {
      console.error('Failed to remove photo:', err)
      setPhotoError('Failed to remove photo')
    } finally {
      setRemovingPhoto(false)
    }
  }

  const showImage = Boolean(user.imageUrl)

  return (
    <SettingsCard>
      <SettingsCardHeader icon={UserRound} title='Profile' />

      <div className='flex items-center gap-4'>
        <div className='relative flex-shrink-0'>
          <button
            type='button'
            onClick={() => fileInputRef.current?.click()}
            disabled={photoBusy}
            aria-label={showImage ? 'Change profile photo' : 'Add profile photo'}
            aria-busy={uploading}
            className='group relative block h-24 w-24 overflow-hidden rounded-full border-2 border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait'
          >
            <Avatar user={user} size='xl' singleInitial className='block' />
            <div
              className={cn(
                'absolute inset-0 flex flex-col items-center justify-center gap-1 bg-foreground/50 text-[11px] font-medium text-white transition-opacity',
                uploading
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
              )}
            >
              {uploading
                ? (
                  <>
                    <Loader2 className='h-5 w-5 animate-spin' />
                    Uploading…
                  </>
                )
                : (
                  <>
                    <Camera className='h-5 w-5' />
                    Change
                  </>
                )}
            </div>
          </button>
          <span
            aria-hidden
            className='pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm'
          >
            <Camera className='h-4 w-4' />
          </span>
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            onChange={handleFileChange}
            disabled={photoBusy}
            className='sr-only'
            tabIndex={-1}
          />
        </div>

        <div className='min-w-0 flex-1'>
          <p className='truncate text-xl font-semibold text-foreground'>{user.name}</p>
          <p className='truncate text-sm text-muted-foreground'>{user.email}</p>
          <div className='mt-2 flex flex-wrap gap-x-3 gap-y-1'>
            <Button
              type='button'
              variant='link'
              size='sm'
              onClick={() => fileInputRef.current?.click()}
              disabled={photoBusy}
              className='h-11 px-0'
            >
              {uploading ? 'Uploading…' : showImage ? 'Change photo' : 'Add photo'}
            </Button>
            {user.imageUrl && (
              <Button
                type='button'
                variant='link'
                size='sm'
                onClick={handleRemovePhoto}
                disabled={photoBusy}
                className='h-11 px-0 text-destructive'
              >
                <Trash2 className='h-3.5 w-3.5' />
                {removingPhoto ? 'Removing…' : 'Remove'}
              </Button>
            )}
          </div>
        </div>
      </div>
      {photoError
        ? <ErrorText className='mt-2'>{photoError}</ErrorText>
        : (
          <p className='mt-2 text-xs text-muted-foreground'>
            JPG or PNG, up to 5MB. Cropped to a square.
          </p>
        )}

      <form onSubmit={handleSaveName} className='mt-6 space-y-4' noValidate>
        <Field
          label='Name'
          htmlFor='profile-name'
          error={nameError || (trimmedName.length === 0 ? "Name can't be empty." : undefined)}
        >
          <div className='flex gap-2'>
            <Input
              id='profile-name'
              type='text'
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError('')
              }}
              maxLength={80}
              autoComplete='name'
              disabled={savingName}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'profile-name-message' : undefined}
              className='flex-1'
            />
            <Button
              type='submit'
              disabled={!canSaveName}
              className='min-w-[84px]'
              aria-live='polite'
            >
              {savingName
                ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Saving
                  </>
                )
                : nameSaved && !nameDirty
                ? (
                  <>
                    <Check className='h-4 w-4' />
                    Saved
                  </>
                )
                : 'Save'}
            </Button>
          </div>
        </Field>

        <Field label='Email' htmlFor='profile-email' help="Email can't be changed.">
          <Input id='profile-email' type='email' value={user.email} disabled readOnly />
        </Field>
      </form>
    </SettingsCard>
  )
}

function cropImageToSquare(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      // Native HTMLImageElement (not next/image) so we can draw it to a canvas.
      const img = document.createElement('img')
      img.onload = () => {
        const size = Math.min(img.width, img.height)
        const x = (img.width - size) / 2
        const y = (img.height - size) / 2

        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 400
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }

        ctx.drawImage(img, x, y, size, size, 0, 0, 400, 400)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create image blob'))
              return
            }
            resolve(
              new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }),
            )
          },
          'image/jpeg',
          0.9,
        )
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
