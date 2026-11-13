import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

type Payload = { title: string; body: string; url: string; tag: string; ts: number }

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/ws/] }))

const same = (raw: unknown): string => {
  try {
    const u = new URL(String(raw ?? '/hoje'), self.location.origin)
    return u.origin === self.location.origin ? `${u.pathname}${u.search}` : '/hoje'
  } catch {
    return '/hoje'
  }
}

self.addEventListener('push', (event) => {
  let p: Payload | null = null
  try {
    p = event.data?.json() as Payload
  } catch {
    return
  }
  if (!p?.title) return
  event.waitUntil(
    self.registration.showNotification(p.title, {
      body: p.body,
      tag: p.tag,
      icon: '/pwa-192.png',
      badge: '/badge-96.png',
      data: { url: same(p.url) },
    }),
  )
})

async function open(url: string): Promise<void> {
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const c = list[0]
  if (!c) {
    await self.clients.openWindow(url)
    return
  }
  await c.focus()
  c.postMessage({ type: 'navigate', url })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(open(same((event.notification.data as { url?: string } | null)?.url)))
})
