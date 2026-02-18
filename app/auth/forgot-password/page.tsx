'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'

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
    <div className="min-h-screen flex items-start justify-center px-4 pt-10" style={{ backgroundColor: '#F9F3E4' }}>
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground mb-2">Reset your password</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Enter the email you used for your account and we&apos;ll send a reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
              {message}
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-4 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        {resetUrl && (
          <p className="mt-4 text-xs text-muted-foreground">
            Dev preview:{' '}
            <Link href={resetUrl} className="break-all text-primary hover:underline">
              {resetUrl}
            </Link>
          </p>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remembered it?{' '}
          <Link href="/auth/signin" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
