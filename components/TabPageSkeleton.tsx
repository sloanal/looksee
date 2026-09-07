import { PageContent, PageHeaderBar } from '@/components/PageHeader'
import { MediaCardSkeletonList } from '@/components/MediaCardSkeleton'
import { Skeleton, SkeletonLine } from '@/components/ui/skeleton'

interface TabPageSkeletonProps {
  /** Search + filter row under the title (Browse, Add). */
  filters?: boolean
  cards?: number
  ratings?: number
}

/**
 * Page-shaped placeholder for a tab's `loading.tsx`: the header band and card
 * run land in their final positions while the route's JS arrives, so switching
 * tabs never flashes an empty canvas.
 */
export function TabPageSkeleton({ filters = false, cards = 3, ratings = 0 }: TabPageSkeletonProps) {
  return (
    <>
      <PageHeaderBar>
        <div className='flex min-h-[44px] items-center gap-2'>
          <Skeleton className='h-7 w-28 rounded' />
          <Skeleton className='h-8 w-28 rounded-full' />
        </div>
        <SkeletonLine className='mt-2 w-56' />
        {filters && (
          <div className='mt-3 space-y-2'>
            <Skeleton className='h-11 w-full rounded-lg' />
            <div className='flex gap-2'>
              <Skeleton className='h-11 flex-1 rounded-lg' />
              <Skeleton className='h-11 flex-1 rounded-lg' />
            </div>
          </div>
        )}
      </PageHeaderBar>

      <PageContent>
        <MediaCardSkeletonList count={cards} ratings={ratings} />
      </PageContent>
    </>
  )
}
