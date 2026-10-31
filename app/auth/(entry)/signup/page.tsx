'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { AuthLink } from '@/components/AuthShell'
import { PasswordInput } from '@/components/marketing/PasswordInput'
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
    <>
      <h1 className='font-display text-4xl leading-[0.95]'>
        Make movie night <span className='font-accent text-[1.1em]'>easy.</span>
      </h1>
      <p className='mt-3 text-muted-foreground'>Create your free account. It takes about a minute.</p>

      <form onSubmit={handleSubmit} className='mt-8 space-y-4'>
        {error && <Notice variant='error'>{error}</Notice>}

        <Field label='Name' htmlFor='name'>
          <Input
            id='name'
            type='text'
            autoComplete='name'
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
            autoComplete='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder='you@example.com'
          />
        </Field>

        <Field label='Password' htmlFor='password' help='At least 6 characters'>
          <PasswordInput
            id='password'
            autoComplete='new-password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder='••••••••'
          />
        </Field>

        <Button type='submit' disabled={loading} size='lg' className='w-full rounded-full'>
          {loading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      <p className='mt-8 text-center text-sm text-muted-foreground'>
        Already have an account? <AuthLink href='/auth/signin'>Log in</AuthLink>
      </p>
    </>
  )
}
