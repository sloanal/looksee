'use client'

import { ReactNode, useId } from 'react'
import { Check } from 'lucide-react'
import { excitementIcon } from '@/components/HouseholdExcitementRow'
import { cn } from '@/lib/utils'

export const STATUS_OPTIONS = [
  { value: 'have_not_seen', label: 'Have not seen' },
  { value: 'already_seen', label: 'Already seen' },
] as const

export const EXCITEMENT_OPTIONS = [
  { value: 1, label: 'Not excited' },
  { value: 3, label: 'Neutral' },
  { value: 5, label: 'Excited' },
] as const

interface RatingFieldsProps {
  status: string
  excitement: number
  onStatusChange: (status: string) => void
  onExcitementChange: (excitement: number) => void
  /** Override when the fields set something other than one title's own rating. */
  statusLegend?: string
  excitementLegend?: string
  className?: string
}

interface ChoiceProps {
  name: string
  value: string | number
  checked: boolean
  onChange: () => void
  children: ReactNode
}

function Choice({ name, value, checked, onChange, children }: ChoiceProps) {
  return (
    <label
      className={cn(
        'flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium transition-colors',
        checked
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-input bg-background text-foreground hover:bg-accent',
      )}
    >
      <input
        type='radio'
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className='sr-only'
      />
      {children}
    </label>
  )
}

/**
 * The "your status" + "your excitement" pickers used by every rating modal.
 * Native radios underneath so keyboard and form semantics stay intact.
 */
export function RatingFields({
  status,
  excitement,
  onStatusChange,
  onExcitementChange,
  statusLegend = 'Your status',
  excitementLegend = 'Your excitement',
  className,
}: RatingFieldsProps) {
  // Two sets of these can share a page (a dialog over a rated card), and radios
  // group by name, so each instance gets its own.
  const group = useId()

  return (
    <div className={cn('space-y-4', className)}>
      <fieldset>
        <legend className='mb-2 block text-sm font-medium text-foreground'>{statusLegend}</legend>
        <div className='flex gap-2'>
          {STATUS_OPTIONS.map((opt) => (
            <Choice
              key={opt.value}
              name={`${group}-status`}
              value={opt.value}
              checked={status === opt.value}
              onChange={() => onStatusChange(opt.value)}
            >
              {status === opt.value && <Check className='h-4 w-4' aria-hidden />}
              {opt.label}
            </Choice>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className='mb-2 block text-sm font-medium text-foreground'>
          {excitementLegend}
        </legend>
        <div className='flex gap-2'>
          {EXCITEMENT_OPTIONS.map((opt) => {
            const Icon = excitementIcon(opt.value)
            return (
              <Choice
                key={opt.value}
                name={`${group}-excitement`}
                value={opt.value}
                checked={excitement === opt.value}
                onChange={() => onExcitementChange(opt.value)}
              >
                <Icon className='h-4 w-4 flex-shrink-0' aria-hidden />
                <span className='truncate'>{opt.label}</span>
              </Choice>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
