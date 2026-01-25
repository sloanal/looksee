'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignInPage() {
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
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else {
        // Check if user has rooms
        try {
          const roomsRes = await fetch('/api/rooms')
          if (!roomsRes.ok) {
            router.push('/rooms/setup')
            return
          }
          const roomsData = await roomsRes.json()
          if (roomsData.rooms && roomsData.rooms.length > 0) {
            router.push('/browse')
          } else {
            router.push('/rooms/setup')
          }
        } catch (err) {
          // If API call fails, redirect to setup
          router.push('/rooms/setup')
        }
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
          <p className="text-muted-foreground">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded">
              {error}
            </div>
          )}

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
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
    </>
  )
}

