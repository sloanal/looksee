'use client'

import { forwardRef, InputHTMLAttributes, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'

/** A password field with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  function PasswordInput(props, ref) {
    const [shown, setShown] = useState(false)
    return (
      <div className='relative'>
        <Input ref={ref} {...props} type={shown ? 'text' : 'password'} className='pr-11' />
        <button
          type='button'
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          className='absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
        >
          {shown ? <EyeOff className='h-4 w-4' aria-hidden /> : <Eye className='h-4 w-4' aria-hidden />}
        </button>
      </div>
    )
  },
)
