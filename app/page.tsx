'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

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
            router.push('/browse')
          } else {
            router.push('/rooms/setup')
          }
        })
        .catch(() => {
          router.push('/rooms/setup')
        })
    }
  }, [session, status, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Looksee</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}

