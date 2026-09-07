'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AuthLink, AuthShell } from '@/components/AuthShell'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'

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
            router.push('/add')
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
    <AuthShell
      hero
      title='Sign in to your account'
      footer={
        <p>
          Don&apos;t have an account? <AuthLink href='/auth/signup'>Sign up</AuthLink>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className='space-y-4'>
        {error && <Notice variant='error'>{error}</Notice>}

        <Field label='Email' htmlFor='email'>
          <Input
            id='email'
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder='you@example.com'
          />
        </Field>

        <Field label='Password' htmlFor='password'>
          <Input
            id='password'
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder='••••••••'
          />
          <div className='mt-2 text-right'>
            <AuthLink href='/auth/forgot-password'>Forgot password?</AuthLink>
          </div>
        </Field>

        <Button type='submit' disabled={loading} size='lg' className='w-full'>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
    </AuthShell>
  )
}
