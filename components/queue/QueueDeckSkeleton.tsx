import { Skeleton, SkeletonLine } from '@/components/ui/skeleton'

/** One frame-height card's worth of placeholder, sitting where the deck will land. */
export function QueueDeckSkeleton() {
  return (
    <div className='mx-auto h-full w-full max-w-md px-4'>
      <div className='flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-pop'>
        <div className='flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-3'>
          <Skeleton className='h-3.5 w-3.5 rounded' />
          <Skeleton className='h-5 w-24 rounded-full' />
        </div>

        <div className='min-h-0 flex-1 space-y-4 p-4'>
          <div className='flex gap-4'>
            <Skeleton className='h-[156px] w-[104px] flex-shrink-0 rounded-lg' />
            <div className='min-w-0 flex-1 space-y-2'>
              <Skeleton className='h-6 w-3/4 rounded' />
              <SkeletonLine className='w-2/5' />
              <div className='flex gap-1 pt-0.5'>
                <Skeleton className='h-5 w-14 rounded-full' />
                <Skeleton className='h-5 w-20 rounded-full' />
              </div>
            </div>
          </div>
          <div className='space-y-2'>
            <SkeletonLine className='w-full' />
            <SkeletonLine className='w-full' />
            <SkeletonLine className='w-4/5' />
          </div>
        </div>

        <div className='flex gap-2 border-t border-border bg-muted/60 px-3 py-3'>
          <Skeleton className='h-11 flex-1 rounded-lg' />
          <Skeleton className='h-11 flex-1 rounded-lg' />
        </div>
      </div>
      <span className='sr-only' role='status' aria-live='polite'>Loading titles</span>
    </div>
  )
}
