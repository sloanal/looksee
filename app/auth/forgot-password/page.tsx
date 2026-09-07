'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { AuthLink, AuthShell } from '@/components/AuthShell'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [resetUrl, setResetUrl] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    setResetUrl('')

    try {
      const res = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }

      setMessage(data.message ?? 'If an account exists for that email, we sent a reset link.')

      // Visible in dev/local while no mail provider is configured.
      if (typeof data.resetUrl === 'string' && data.resetUrl) {
        setResetUrl(data.resetUrl)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title='Reset your password'
      description="Enter the email you used for your account and we'll send a reset link."
      footer={
        <p>
          Remembered it? <AuthLink href='/auth/signin'>Back to sign in</AuthLink>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className='space-y-4'>
        {error && <Notice variant='error'>{error}</Notice>}
        {message && <Notice variant='success'>{message}</Notice>}

        <Field label='Email' htmlFor='email'>
          <Input
            id='email'
            type='email'
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder='you@example.com'
          />
        </Field>

        <Button type='submit' disabled={loading} size='lg' className='w-full'>
          {loading ? 'Sending...' : 'Send reset link'}
        </Button>
      </form>

      {resetUrl && (
        <p className='mt-4 text-xs text-muted-foreground'>
          Dev preview:{' '}
          <Link
            href={resetUrl}
            className='break-all text-foreground underline-offset-4 hover:underline'
          >
            {resetUrl}
          </Link>
        </p>
      )}
    </AuthShell>
  )
}
