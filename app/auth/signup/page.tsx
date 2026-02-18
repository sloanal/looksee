'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

export default function SignUpPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }

      // Auto sign in after signup
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.ok) {
        router.push('/rooms/setup')
      } else {
        router.push('/auth/signin')
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          #name::placeholder,
          #name::-webkit-input-placeholder {
            color: #d1d5db !important;
            -webkit-text-fill-color: #d1d5db !important;
          }
          #email::placeholder,
          #email::-webkit-input-placeholder {
            color: #d1d5db !important;
            -webkit-text-fill-color: #d1d5db !important;
          }
          #password::placeholder,
          #password::-webkit-input-placeholder {
            color: #d1d5db !important;
            -webkit-text-fill-color: #d1d5db !important;
          }
        `
      }} />
      <div className="min-h-screen flex items-start justify-center px-4 pt-4" style={{ backgroundColor: '#F9F3E4' }}>
      <div className="w-full max-w-md">
        <div className="mb-3 flex justify-center overflow-hidden" style={{ height: '180px', width: '100vw', marginLeft: '-1rem', marginRight: '-1rem' }}>
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full rounded-lg object-cover"
            style={{ objectPosition: 'center', height: '150%', marginTop: '-10%' }}
          >
            <source src="/welcome.mp4" type="video/mp4" />
          </video>
        </div>

        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold mb-2 text-foreground">Looksee</h1>
          <p className="text-sm text-black mb-4">Share and compare movies and shows with your friends and housemates</p>
          <p className="text-muted-foreground">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Your name"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="you@example.com"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="••••••••"
            />
            <p className="mt-1 text-xs text-muted-foreground">At least 6 characters</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Forgot your password?{' '}
          <Link href="/auth/forgot-password" className="text-primary hover:underline">
            Reset it
          </Link>
        </p>
      </div>
    </div>
    </>
  )
}

