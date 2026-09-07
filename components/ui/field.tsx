import { ReactNode, useId } from 'react'
import { cn } from '@/lib/utils'

interface FieldProps {
  label: ReactNode
  /** id of the control; generated when omitted (read it back via the render prop). */
  htmlFor?: string
  required?: boolean
  help?: ReactNode
  error?: ReactNode
  className?: string
  children: ReactNode | ((ids: { id: string; describedBy?: string }) => ReactNode)
}

/** Label + control + one help or error line, with ids wired for screen readers. */
export function Field({ label, htmlFor, required, help, error, className, children }: FieldProps) {
  const generated = useId()
  const id = htmlFor ?? generated
  const messageId = `${id}-message`
  const hasMessage = Boolean(error || help)

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className='block text-sm font-medium text-foreground'>
        {label}
        {required && (
          <span className='text-muted-foreground' aria-hidden>
            {' '}*
          </span>
        )}
      </label>
      {typeof children === 'function'
        ? children({ id, describedBy: hasMessage ? messageId : undefined })
        : children}
      {error
        ? (
          <p id={messageId} role='alert' className='text-sm text-destructive'>
            {error}
          </p>
        )
        : help
        ? <p id={messageId} className='text-xs text-muted-foreground'>{help}</p>
        : null}
    </div>
  )
}

interface ErrorTextProps {
  children: ReactNode
  className?: string
}

/** Inline error line, for use outside a `Field`. */
export function ErrorText({ children, className }: ErrorTextProps) {
  return (
    <p role='alert' className={cn('text-sm text-destructive', className)}>
      {children}
    </p>
  )
}
