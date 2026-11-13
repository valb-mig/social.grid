import type { Bus } from '@social-grid/core/bus.ts'
import type { Wire } from '@social-grid/core/chat.ts'
import type { FastifyInstance } from 'fastify'
import type { WebSocket } from 'ws'
import { z } from 'zod'

const MAX = 16
const BEAT = 30_000

const msg = z.object({ t: z.literal('ping') })

export type Room = {
  size(): number
  send(m: Wire): void
  add(s: WebSocket): boolean
  name(s: WebSocket, name: string): void
  peers(): string[]
  drop(s: WebSocket): void
  close(): void
}

export type Who = (ip: string) => Promise<string | null>

export function room(max = MAX): Room {
  const clients = new Map<WebSocket, string | null>()
  const peers = () => [...new Set([...clients.values()].filter((n): n is string => !!n))].sort()
  const send = (m: Wire) => {
    const s = JSON.stringify(m)
    for (const c of clients.keys()) if (c.readyState === 1) c.send(s)
  }
  const tell = () => send({ t: 'peers', list: peers() })
  return {
    size: () => clients.size,
    send,
    add(s) {
      if (clients.size >= max) return false
      clients.set(s, null)
      if (s.readyState === 1) s.send(JSON.stringify({ t: 'peers', list: peers() }))
      return true
    },
    name(s, name) {
      if (!clients.has(s)) return
      clients.set(s, name)
      tell()
    },
    peers,
    drop(s) {
      const had = clients.get(s)
      clients.delete(s)
      if (had) tell()
    },
    close() {
      for (const c of clients.keys()) c.terminate()
      clients.clear()
    },
  }
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim() ?? ''

export function socket(app: FastifyInstance, r: Room, bus: Bus, who?: Who) {
  bus.on('post', (e) => r.send({ t: 'post', id: e.id }))
  bus.on('config', () => r.send({ t: 'config' }))

  app.get('/ws', { websocket: true }, (sock, req) => {
    if (!r.add(sock)) return sock.close(1013, 'cheio')
    const ip = first(req.headers['x-forwarded-for'])
    if (ip && who) void who(ip).then((name) => name && r.name(sock, name))
    let alive = true
    sock.on('pong', () => {
      alive = true
    })
    const beat = setInterval(() => {
      if (!alive) return sock.terminate()
      alive = false
      sock.ping()
    }, BEAT)
    sock.on('message', (raw) => {
      let data: unknown
      try {
        data = JSON.parse(String(raw))
      } catch {
        return
      }
      if (msg.safeParse(data).success) sock.send(JSON.stringify({ t: 'pong' }))
    })
    sock.on('close', () => {
      clearInterval(beat)
      r.drop(sock)
    })
  })
}
