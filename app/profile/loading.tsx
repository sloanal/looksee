import { PageContent, PageHeaderBar } from '@/components/PageHeader'
import { SettingsCardSkeletonList } from '@/components/settings/SettingsCardSkeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <>
      <PageHeaderBar className='pb-0'>
        <div className='flex min-h-[44px] items-center'>
          <Skeleton className='h-7 w-32 rounded' />
        </div>
        <div className='mt-3 flex gap-2'>
          <Skeleton className='h-9 w-20 rounded' />
          <Skeleton className='h-9 w-20 rounded' />
        </div>
      </PageHeaderBar>

      <PageContent>
        <SettingsCardSkeletonList />
      </PageContent>
    </>
  )
}
