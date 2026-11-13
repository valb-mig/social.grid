import { api } from './api.ts'

export type PushState = 'unsupported' | 'denied' | 'off' | 'on'

async function reg(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return null
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 4000))
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

const key = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

export async function status(): Promise<PushState> {
  const r = await reg()
  if (!r) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  return (await r.pushManager.getSubscription()) ? 'on' : 'off'
}

export async function enable(): Promise<PushState> {
  const r = await reg()
  if (!r) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off'
  const { key: k } = await api.push()
  let sub = await r.pushManager.getSubscription()
  if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(k) })
  await api.subscribe(sub.toJSON())
  return 'on'
}

export async function disable(): Promise<PushState> {
  const r = await reg()
  const sub = await r?.pushManager.getSubscription()
  if (sub) {
    await api.unsubscribe(sub.endpoint).catch(() => undefined)
    await sub.unsubscribe()
  }
  return 'off'
}

export async function renew(): Promise<void> {
  if ((await status()) !== 'on') return
  const sub = await (await reg())?.pushManager.getSubscription()
  if (sub) await api.subscribe(sub.toJSON()).catch(() => undefined)
}
