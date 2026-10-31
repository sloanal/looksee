import { pageContainerClassName } from '@/components/PageHeader'
import { Skeleton, SkeletonLine } from '@/components/ui/skeleton'

/** Mirrors Add's centered search so the box doesn't jump when the page loads. */
export default function Loading() {
  return (
    <div className={pageContainerClassName}>
      <div className='safe-top tab-viewport-height flex flex-col items-center justify-center px-4 pb-[6vh]'>
        <div className='motion-placeholder flex w-full max-w-lg flex-col items-center'>
          <div className='aspect-[16/10] w-44 sm:w-52' />
          <Skeleton className='mt-1 h-8 w-64 rounded' />
          <div className='mt-3 flex items-center gap-2'>
            <SkeletonLine className='w-16' />
            <Skeleton className='h-9 w-28 rounded-full' />
          </div>
          <Skeleton className='mt-6 h-14 w-full rounded-2xl' />
          <SkeletonLine className='mt-5 w-28' />
        </div>
      </div>
    </div>
  )
}
