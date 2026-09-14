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

        <Skeleton className='mx-4 mt-3 h-6 w-3/5 rounded' />

        <div className='min-h-0 flex-1 space-y-4 p-4'>
          <SkeletonLine className='w-2/5' />
          <div className='space-y-1.5'>
            <Skeleton className='h-12 w-full rounded-xl' />
            <Skeleton className='h-12 w-full rounded-xl' />
          </div>
          <Skeleton className='mx-auto aspect-[2/3] w-full max-w-[180px] rounded-xl' />
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
