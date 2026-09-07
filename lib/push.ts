import webpush, { WebPushError } from 'web-push'
import { prisma } from '@/lib/prisma'

export type PushPayload = {
  title: string
  body: string
  url: string
  tag?: string
  icon?: string
}

type SubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

const DEBOUNCE_MS = 8_000
const DEFAULT_ICON = '/icon-192x192.png'

function readVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) return null
  return { publicKey, privateKey, subject }
}

export function getVapidPublicKey(): string | null {
  return readVapidConfig()?.publicKey ?? null
}

export function isPushConfigured(): boolean {
  return readVapidConfig() !== null
}

let vapidApplied = false
function ensureVapid(): boolean {
  const config = readVapidConfig()
  if (!config) return false
  if (!vapidApplied) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
    vapidApplied = true
  }
  return true
}

function isGoneStatus(status: number | undefined): boolean {
  return status === 404 || status === 410
}

/**
 * Deliver one payload to a set of subscriptions in parallel. Subscriptions the
 * push service reports as gone (404/410) are deleted; any other failure
 * (network, DNS, 5xx) is logged and the subscription kept. Never throws.
 */
export async function sendPushToSubscriptions(
  subscriptions: SubscriptionRow[],
  payload: PushPayload,
): Promise<{ sent: number; pruned: number; failed: number }> {
  const result = { sent: 0, pruned: 0, failed: 0 }
  if (subscriptions.length === 0 || !ensureVapid()) return result

  const body = JSON.stringify({ ...payload, icon: payload.icon ?? DEFAULT_ICON })
  const deadIds: string[] = []
  const liveIds: string[] = []

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 60 * 60 * 24 },
        )
        result.sent += 1
        liveIds.push(sub.id)
      } catch (error) {
        const status = error instanceof WebPushError ? error.statusCode : undefined
        if (isGoneStatus(status)) {
          result.pruned += 1
          deadIds.push(sub.id)
          console.info(`[push] pruning subscription ${sub.id} (push service returned ${status})`)
        } else {
          result.failed += 1
          const message = error instanceof Error ? error.message : String(error)
          console.warn(`[push] send failed for subscription ${sub.id}: ${message}`)
        }
      }
    }),
  )

  try {
    if (deadIds.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: deadIds } } })
    }
    if (liveIds.length > 0) {
      await prisma.pushSubscription.updateMany({
        where: { id: { in: liveIds } },
        data: { lastUsedAt: new Date() },
      })
    }
  } catch (error) {
    console.warn('[push] failed to update subscription bookkeeping:', error)
  }

  return result
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!isPushConfigured()) return { sent: 0, pruned: 0, failed: 0 }
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })
  return sendPushToSubscriptions(subscriptions, payload)
}

type PendingBatch = {
  mediaItemIds: Set<string>
  timer: ReturnType<typeof setTimeout>
}

/**
 * In-process debounce keyed by actor+room so a burst of adds (e.g. rating a
 * handful of titles in a row) becomes one notification. This only holds within
 * a single long-lived process: on serverless (Vercel functions) the instance
 * may be frozen or recycled before the timer fires, so there we send
 * immediately and rely on the service worker's `tag` to collapse the burst on
 * the device instead.
 */
const pendingBatches = new Map<string, PendingBatch>()

function shouldDebounce(): boolean {
  return !process.env.VERCEL && process.env.PUSH_DEBOUNCE !== 'off'
}

async function deliverRoomAdditions(input: {
  actorUserId: string
  roomId: string
  mediaItemIds: string[]
}) {
  const { actorUserId, roomId } = input
  const mediaItemIds = Array.from(new Set(input.mediaItemIds))
  if (mediaItemIds.length === 0) return

  const [room, actor, firstItem] = await Promise.all([
    prisma.room.findUnique({ where: { id: roomId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: actorUserId }, select: { name: true } }),
    mediaItemIds.length === 1
      ? prisma.mediaItem.findUnique({ where: { id: mediaItemIds[0] }, select: { title: true } })
      : Promise.resolve(null),
  ])
  if (!room || !actor) return

  // Recipients are the room's current members (minus the actor). Every
  // recipient is therefore a member of `roomId` by construction, so naming the
  // room and the title in the payload leaks nothing they couldn't already see.
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId: { not: actorUserId },
      user: { roomMemberships: { some: { roomId } } },
    },
    select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
  })

  const recipientCount = new Set(subscriptions.map((sub) => sub.userId)).size
  console.debug(
    `[push] room ${roomId}: ${mediaItemIds.length} title(s) by ${actorUserId} -> ${recipientCount} recipient(s), ${subscriptions.length} subscription(s)`,
  )
  if (subscriptions.length === 0) return

  const what = mediaItemIds.length === 1 && firstItem
    ? firstItem.title
    : `${mediaItemIds.length} titles`

  const outcome = await sendPushToSubscriptions(subscriptions, {
    title: 'Looksee',
    body: `${actor.name} added ${what} to ${room.name}`,
    url: '/new',
    tag: `room-${roomId}`,
  })
  console.debug(
    `[push] room ${roomId}: sent=${outcome.sent} pruned=${outcome.pruned} failed=${outcome.failed}`,
  )
}

/**
 * Fire-and-forget: notify the other members of `roomId` that `actorUserId`
 * added `mediaItemIds`. Safe to call with `void`; it never throws and is a
 * no-op when VAPID isn't configured.
 */
export async function notifyRoomAdditions(input: {
  actorUserId: string
  roomId: string
  mediaItemIds: string[]
}): Promise<void> {
  try {
    if (!isPushConfigured() || input.mediaItemIds.length === 0) return

    if (!shouldDebounce()) {
      await deliverRoomAdditions(input)
      return
    }

    const key = `${input.actorUserId}:${input.roomId}`
    const existing = pendingBatches.get(key)
    if (existing) {
      input.mediaItemIds.forEach((id) => existing.mediaItemIds.add(id))
      return
    }

    const batch: PendingBatch = {
      mediaItemIds: new Set(input.mediaItemIds),
      timer: setTimeout(() => {
        pendingBatches.delete(key)
        deliverRoomAdditions({
          actorUserId: input.actorUserId,
          roomId: input.roomId,
          mediaItemIds: Array.from(batch.mediaItemIds),
        }).catch((error) => {
          console.error('[push] failed to deliver room additions:', error)
        })
      }, DEBOUNCE_MS),
    }
    pendingBatches.set(key, batch)
  } catch (error) {
    console.error('[push] notifyRoomAdditions failed:', error)
  }
}
