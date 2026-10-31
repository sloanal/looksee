import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LandingPage } from '@/components/marketing/LandingPage'

export const metadata: Metadata = {
  title: 'Looksee: spend less time deciding what to watch',
}

/**
 * Signed-in visitors (including the installed app, whose start_url is `/`)
 * go straight into the app; everyone else gets the landing page. Deciding on
 * the server means neither ever sees the other's screen flash by.
 */
export default async function Home() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return <LandingPage />

  let hasRooms = false
  try {
    hasRooms = (await prisma.roomMembership.count({ where: { userId: session.user.id } })) > 0
  } catch (error) {
    console.error('[HOME] Could not count rooms:', error)
  }
  redirect(hasRooms ? '/add' : '/rooms/setup')
}
