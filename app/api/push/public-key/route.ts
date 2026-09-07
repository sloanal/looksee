import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getVapidPublicKey } from '@/lib/push'

// GET /api/push/public-key - VAPID public key the browser subscribes with
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const publicKey = getVapidPublicKey()
  if (!publicKey) {
    return NextResponse.json({ publicKey: null, configured: false })
  }
  return NextResponse.json({ publicKey, configured: true })
}
