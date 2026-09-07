import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Native select styled to match `Input`, with a real chevron. */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className={cn('relative', className)}>
        <select
          ref={ref}
          className='h-11 w-full appearance-none rounded-lg border border-input bg-background pl-3.5 pr-9 text-base text-foreground shadow-sm sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground'
          aria-hidden
        />
      </div>
    )
  },
)
Select.displayName = 'Select'

export { Select }
