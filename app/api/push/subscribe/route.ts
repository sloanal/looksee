import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPushConfigured } from '@/lib/push'

const MAX_ENDPOINT_LENGTH = 2048
const MAX_USER_AGENT_LENGTH = 512

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

// POST /api/push/subscribe - register (or re-assign to the caller) a browser push subscription
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isPushConfigured()) {
    return NextResponse.json({ error: 'Push notifications are not configured' }, { status: 503 })
  }

  const body = await request.json().catch(() => null)
  const subscription = body?.subscription
  const endpoint: unknown = subscription?.endpoint
  const p256dh: unknown = subscription?.keys?.p256dh
  const auth: unknown = subscription?.keys?.auth

  if (
    typeof endpoint !== 'string' ||
    endpoint.length > MAX_ENDPOINT_LENGTH ||
    !isHttpsUrl(endpoint) ||
    typeof p256dh !== 'string' ||
    !p256dh ||
    typeof auth !== 'string' ||
    !auth
  ) {
    return NextResponse.json({ error: 'A valid push subscription is required' }, { status: 400 })
  }

  const userAgent = typeof body?.userAgent === 'string'
    ? body.userAgent.slice(0, MAX_USER_AGENT_LENGTH)
    : request.headers.get('user-agent')?.slice(0, MAX_USER_AGENT_LENGTH) ?? null

  // Endpoints are unique per browser profile. If one shows up under a different
  // account (e.g. two people sharing a device signed in and out), the most
  // recent sign-in owns it, so the previous user stops receiving pushes here.
  const saved = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: session.user.id, endpoint, p256dh, auth, userAgent },
    update: { userId: session.user.id, p256dh, auth, userAgent },
    select: { id: true, endpoint: true, createdAt: true },
  })

  return NextResponse.json({ subscription: saved })
}

// DELETE /api/push/subscribe - remove one of the caller's subscriptions by endpoint
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const endpoint: unknown = body?.endpoint
  if (typeof endpoint !== 'string' || !endpoint) {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })
  }

  const deleted = await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  })

  return NextResponse.json({ removed: deleted.count })
}
