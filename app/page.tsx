'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LoadingScreen } from '@/components/LoadingScreen'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
    } else {
      // Check if user has rooms
      fetch('/api/rooms')
        .then((res) => {
          if (!res.ok) {
            router.push('/rooms/setup')
            return
          }
          return res.json()
        })
        .then((data) => {
          if (data && data.rooms && data.rooms.length > 0) {
            router.push('/add')
          } else {
            router.push('/rooms/setup')
          }
        })
        .catch(() => {
          router.push('/rooms/setup')
        })
    }
  }, [session, status, router])

  return <LoadingScreen label={session ? 'Finding your rooms' : 'Getting things ready'} />
}
