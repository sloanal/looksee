import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isPushConfigured, sendPushToUser } from '@/lib/push'

// POST /api/push/test - send a test notification to the caller's own devices
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isPushConfigured()) {
    return NextResponse.json({ error: 'Push notifications are not configured' }, { status: 503 })
  }

  const result = await sendPushToUser(session.user.id, {
    title: 'Looksee',
    body: "Notifications are working. You'll hear about new titles in your rooms here.",
    url: '/new',
    tag: 'test',
  })

  return NextResponse.json(result)
}
