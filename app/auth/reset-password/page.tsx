'use client'

import { FormEvent, useMemo, useState } from 'react'
import { AuthLink, AuthShell } from '@/components/AuthShell'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams])

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!token) {
      setError('Reset link is missing a token.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Could not reset password')
        return
      }

      setSuccess(data.message ?? 'Password reset successful.')

      setTimeout(() => {
        router.push('/auth/signin')
      }, 1200)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title='Choose a new password'
      description='Enter your new password below.'
      footer={
        <p>
          <AuthLink href='/auth/signin'>Back to sign in</AuthLink>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className='space-y-4'>
        {error && <Notice variant='error'>{error}</Notice>}
        {success && <Notice variant='success'>{success}</Notice>}

        <Field label='New password' htmlFor='password'>
          <Input
            id='password'
            type='password'
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder='••••••••'
          />
        </Field>

        <Field label='Confirm new password' htmlFor='confirmPassword'>
          <Input
            id='confirmPassword'
            type='password'
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder='••••••••'
          />
        </Field>

        <Button type='submit' disabled={loading || !token} size='lg' className='w-full'>
          {loading ? 'Resetting...' : 'Reset password'}
        </Button>
      </form>
    </AuthShell>
  )
}
