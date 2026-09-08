import { pageContainerClassName, PageHeaderBar } from '@/components/PageHeader'
import { QueueDeckSkeleton } from '@/components/queue/QueueDeckSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export default function Loading() {
  return (
    <div className={cn(pageContainerClassName, 'flex min-h-0 flex-1 flex-col')}>
      <PageHeaderBar className='space-y-2.5'>
        <div className='flex min-h-[44px] items-center justify-between gap-2'>
          <Skeleton className='h-7 w-20 rounded' />
          <Skeleton className='h-9 w-28 rounded-lg' />
        </div>
        <div className='mx-auto flex w-full max-w-md gap-2'>
          {[0, 1, 2].map((key) => <Skeleton key={key} className='h-[52px] flex-1 rounded-lg' />)}
        </div>
      </PageHeaderBar>

      <div className='min-h-0 flex-1 pt-3'>
        <QueueDeckSkeleton />
      </div>
    </div>
  )
}
