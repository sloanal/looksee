/* Looksee service worker: web push only (no offline caching). */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

function parsePayload(event) {
  if (!event.data) return {}
  try {
    return event.data.json()
  } catch (_err) {
    return { body: event.data.text() }
  }
}

self.addEventListener('push', (event) => {
  const payload = parsePayload(event)
  const title = payload.title || 'Looksee'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: payload.tag || 'looksee',
    renotify: true,
    data: { url: payload.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin)
    .href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.indexOf(self.location.origin) === 0)
      if (existing) {
        return existing.focus().then((focused) => {
          if (focused && 'navigate' in focused) return focused.navigate(url)
          return focused
        })
      }
      return self.clients.openWindow(url)
    }),
  )
})
