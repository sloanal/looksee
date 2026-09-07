import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPushConfigured } from '@/lib/push'

// GET /api/push/status?endpoint=... - is this device (or any device) subscribed for the caller
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const endpoint = request.nextUrl.searchParams.get('endpoint')

  const [count, thisDevice] = await Promise.all([
    prisma.pushSubscription.count({ where: { userId: session.user.id } }),
    endpoint
      ? prisma.pushSubscription.findFirst({
        where: { endpoint, userId: session.user.id },
        select: { id: true },
      })
      : Promise.resolve(null),
  ])

  return NextResponse.json({
    configured: isPushConfigured(),
    subscribed: endpoint ? thisDevice !== null : count > 0,
    count,
  })
}
