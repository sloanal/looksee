import { Card, CardBand } from '@/components/ui/card'
import { Skeleton, SkeletonLine } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface MediaCardSkeletonProps {
  /** Room chips strip above the title (Browse, New). */
  rooms?: boolean
  /** Rating rows beneath the title (Browse). */
  ratings?: number
  className?: string
}

/** Media card placeholder: same poster, meta and band geometry as the real one. */
export function MediaCardSkeleton(
  { rooms = true, ratings = 0, className }: MediaCardSkeletonProps,
) {
  return (
    <Card className={className}>
      {rooms && (
        <CardBand position='top' className='flex min-h-[40px] items-center gap-2'>
          <Skeleton className='h-3.5 w-3.5 rounded' />
          <Skeleton className='h-5 w-24 rounded-full' />
        </CardBand>
      )}

      <div className='flex gap-4'>
        <Skeleton className='h-[120px] w-20 flex-shrink-0 rounded-lg' />
        <div className='min-w-0 flex-1 space-y-2'>
          <Skeleton className='h-5 w-1/2 rounded' />
          <SkeletonLine className='w-2/5' />
          <div className='flex gap-1 pt-0.5'>
            <Skeleton className='h-5 w-14 rounded-full' />
            <Skeleton className='h-5 w-20 rounded-full' />
          </div>
          <SkeletonLine className='w-full' />
          <SkeletonLine className='w-4/5' />
        </div>
      </div>

      {ratings > 0 && (
        <CardBand position='bottom' className='space-y-2 py-3'>
          {Array.from({ length: ratings }).map((_, i) => (
            <div key={i} className='flex items-center gap-2'>
              <Skeleton className='h-7 w-7 flex-shrink-0 rounded-full' />
              <SkeletonLine className={i === 0 ? 'w-40' : 'w-32'} />
            </div>
          ))}
        </CardBand>
      )}
    </Card>
  )
}

interface MediaCardSkeletonListProps {
  count?: number
  rooms?: boolean
  ratings?: number
  className?: string
}

/** A short run of media card placeholders. */
export function MediaCardSkeletonList({
  count = 3,
  rooms = true,
  ratings = 0,
  className,
}: MediaCardSkeletonListProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <MediaCardSkeleton key={i} rooms={rooms} ratings={ratings} />
      ))}
      <span className='sr-only' role='status' aria-live='polite'>
        Loading titles
      </span>
    </div>
  )
}
