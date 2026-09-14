import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { HouseholdUser } from '@/components/HouseholdExcitementRow'

/**
 * The signed-in user as a household member, for the rows and chips that list
 * everyone's opinion. The session only carries id and name, so the avatar is
 * read from the profile once. Null until someone is signed in.
 */
export function useViewer(): HouseholdUser | null {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    fetch('/api/user/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setImageUrl(data?.user?.imageUrl ?? null)
      })
      .catch(() => {
        if (!cancelled) setImageUrl(null)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  if (!userId) return null
  return { id: userId, name: session?.user?.name || 'You', imageUrl }
}
