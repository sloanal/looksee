'use client'

import { useCallback, useEffect, useState } from 'react'

export type PushState =
  | 'loading'
  | 'unsupported'
  | 'unconfigured'
  | 'denied'
  | 'disabled'
  | 'enabled'

const SW_PATH = '/sw.js'

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isIosNotStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!isIos) return false
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone
  return standalone === false
}

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normalized)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output.buffer as ArrayBuffer
}

async function getRegistration(create: boolean): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  const existing = await navigator.serviceWorker.getRegistration(SW_PATH)
  if (existing) return existing
  if (!create) return null
  const registration = await navigator.serviceWorker.register(SW_PATH)
  await navigator.serviceWorker.ready
  return registration
}

async function fetchPublicKey(): Promise<string | null> {
  const res = await fetch('/api/push/public-key')
  if (!res.ok) return null
  const data = await res.json()
  return typeof data.publicKey === 'string' ? data.publicKey : null
}

export function usePush() {
  const [state, setState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setState('unsupported')
      return
    }
    try {
      const publicKey = await fetchPublicKey()
      if (!publicKey) {
        setState('unconfigured')
        return
      }
      if (Notification.permission === 'denied') {
        setState('denied')
        return
      }
      const registration = await getRegistration(false)
      const subscription = await registration?.pushManager.getSubscription()
      if (!subscription) {
        setState('disabled')
        return
      }
      const res = await fetch(
        `/api/push/status?endpoint=${encodeURIComponent(subscription.endpoint)}`,
      )
      const status = res.ok ? await res.json() : null
      if (status?.subscribed) {
        setState('enabled')
        return
      }
      // Browser is subscribed but the server has no record (e.g. DB reset or a
      // different account on this device): re-register it for the current user.
      const saved = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      })
      setState(saved.ok ? 'enabled' : 'disabled')
    } catch (err) {
      console.error('Failed to read push state:', err)
      setState('disabled')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const enable = useCallback(async () => {
    if (!isPushSupported()) return
    setBusy(true)
    setError(null)
    try {
      const publicKey = await fetchPublicKey()
      if (!publicKey) {
        setState('unconfigured')
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'disabled')
        return
      }
      const registration = await getRegistration(true)
      if (!registration) {
        setState('unsupported')
        return
      }
      const subscription = (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(publicKey),
        }))
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save subscription')
      }
      setState('enabled')
    } catch (err) {
      console.error('Failed to enable notifications:', err)
      setError(err instanceof Error ? err.message : 'Failed to enable notifications')
      setState(Notification.permission === 'denied' ? 'denied' : 'disabled')
    } finally {
      setBusy(false)
    }
  }, [])

  const disable = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const registration = await getRegistration(false)
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setState('disabled')
    } catch (err) {
      console.error('Failed to disable notifications:', err)
      setError(err instanceof Error ? err.message : 'Failed to disable notifications')
    } finally {
      setBusy(false)
    }
  }, [])

  const sendTest = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to send test notification')
      if (!data.sent) {
        setError('No device received the test. Try disabling and re-enabling notifications.')
        return false
      }
      return true
    } catch (err) {
      console.error('Failed to send test notification:', err)
      setError(err instanceof Error ? err.message : 'Failed to send test notification')
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  return { state, busy, error, enable, disable, sendTest, refresh }
}
