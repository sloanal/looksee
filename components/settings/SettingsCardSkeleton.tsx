import { Skeleton, SkeletonLine } from '@/components/ui/skeleton'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { cn } from '@/lib/utils'

/** Settings card placeholder: heading, sub-line and one control row. */
export function SettingsCardSkeleton({ avatar = false }: { avatar?: boolean }) {
  return (
    <SettingsCard>
      <div className='flex items-center gap-4'>
        {avatar && <Skeleton className='h-24 w-24 flex-shrink-0 rounded-full' />}
        <div className='min-w-0 flex-1 space-y-2'>
          <Skeleton className='h-5 w-1/3 rounded' />
          <SkeletonLine className='w-1/2' />
        </div>
      </div>
      <Skeleton className='mt-4 h-11 w-full rounded-lg' />
    </SettingsCard>
  )
}

/** The stack of cards a Settings tab opens with. */
export function SettingsCardSkeletonList({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      <SettingsCardSkeleton avatar />
      <SettingsCardSkeleton />
      <SettingsCardSkeleton />
      <span className='sr-only' role='status' aria-live='polite'>
        Loading settings
      </span>
    </div>
  )
}
