import * as React from 'react'

import { cn } from '@/lib/utils'

export const inputClassName =
  'flex h-11 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-base text-foreground shadow-sm sm:text-sm placeholder:text-muted-foreground/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return <input type={type} className={cn(inputClassName, className)} ref={ref} {...props} />
  },
)
Input.displayName = 'Input'

export { Input }
