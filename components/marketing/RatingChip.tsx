import { Eye, Frown, Meh, Smile, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PEOPLE, Person, Rating } from './demo-data'

const META: Record<string, { label: string; icon: typeof Smile }> = {
  '5': { label: 'Excited', icon: Smile },
  '3': { label: 'Neutral', icon: Meh },
  '1': { label: 'Not excited', icon: Frown },
  seen: { label: 'Seen it', icon: Eye },
  none: { label: 'Not rated', icon: HelpCircle },
}

/** A person's take on a title, in the style of the app's household row. */
export function RatingChip(
  { person, rating, className }: { person: Person; rating?: Rating; className?: string },
) {
  const meta = META[rating === undefined ? 'none' : String(rating)]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-background py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-foreground',
        className,
      )}
    >
      <span
        className='grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-ink'
        style={{ background: PEOPLE[person].color }}
        aria-hidden
      >
        {PEOPLE[person].initial}
      </span>
      <span className='sr-only'>{PEOPLE[person].name}:</span>
      <Icon className='h-3.5 w-3.5 text-muted-foreground' aria-hidden />
      {meta.label}
    </span>
  )
}
