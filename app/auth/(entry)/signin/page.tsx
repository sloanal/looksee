'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AuthLink } from '@/components/AuthShell'
import { PasswordInput } from '@/components/marketing/PasswordInput'
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
    <>
      <h1 className='font-display text-4xl leading-[0.95]'>Welcome back.</h1>
      <p className='mt-3 text-muted-foreground'>Log in and see what&apos;s on tonight.</p>

      <form onSubmit={handleSubmit} className='mt-8 space-y-4'>
        {error && <Notice variant='error'>{error}</Notice>}

        <Field label='Email' htmlFor='email'>
          <Input
            id='email'
            type='email'
            autoComplete='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder='you@example.com'
          />
        </Field>

        <Field label='Password' htmlFor='password'>
          <PasswordInput
            id='password'
            autoComplete='current-password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder='••••••••'
          />
          <div className='mt-2 text-right text-sm'>
            <AuthLink href='/auth/forgot-password'>Forgot password?</AuthLink>
          </div>
        </Field>

        <Button type='submit' disabled={loading} size='lg' className='w-full rounded-full'>
          {loading ? 'Logging in...' : 'Log in'}
        </Button>
      </form>

      <p className='mt-8 text-center text-sm text-muted-foreground'>
        New to Looksee? <AuthLink href='/auth/signup'>Create an account</AuthLink>
      </p>
    </>
  )
}
