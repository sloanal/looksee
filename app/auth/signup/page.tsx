'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { AuthLink, AuthShell } from '@/components/AuthShell'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'

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
    <AuthShell
      hero
      title='Create your account'
      footer={
        <>
          <p>
            Already have an account? <AuthLink href='/auth/signin'>Sign in</AuthLink>
          </p>
          <p>
            Forgot your password? <AuthLink href='/auth/forgot-password'>Reset it</AuthLink>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className='space-y-4'>
        {error && <Notice variant='error'>{error}</Notice>}

        <Field label='Name' htmlFor='name'>
          <Input
            id='name'
            type='text'
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder='Your name'
          />
        </Field>

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

        <Field label='Password' htmlFor='password' help='At least 6 characters'>
          <Input
            id='password'
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder='••••••••'
          />
        </Field>

        <Button type='submit' disabled={loading} size='lg' className='w-full'>
          {loading ? 'Creating account...' : 'Sign Up'}
        </Button>
      </form>
    </AuthShell>
  )
}
