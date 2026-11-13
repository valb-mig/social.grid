import type { FastifyReply, FastifyRequest } from 'fastify'

export type Policy = { hosts: Set<string>; tailnet: Set<string>; logins: Set<string> }

export type Req = {
  method: string
  host: string
  origin?: string
  route: string
  type: string
  login?: string
  proxied: boolean
  ws: boolean
}

export type Verdict = { code: number; error: string } | null

export const UPLOAD = '/api/posts/:id/media'
export const PICS = '/api/chat/images'
const FORMS = new Set([UPLOAD, PICS])

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

export function policy(hosts: string[], logins: string[] = []): Policy {
  return { hosts: new Set(hosts), tailnet: new Set(), logins: new Set(logins) }
}

export function allow(r: Req, p: Policy): Verdict {
  const local = p.hosts.has(r.host)
  const tail = p.tailnet.has(r.host)
  if (!local && !tail) return { code: 403, error: 'host_not_allowed' }
  if (tail || r.proxied) {
    if (!tail || !r.login || !p.logins.has(r.login)) return { code: 403, error: 'tailnet_identity_required' }
  }
  const unsafe = !SAFE.has(r.method)
  if (r.origin !== undefined || unsafe || r.ws) {
    if (!r.origin || r.origin === 'null') return { code: 403, error: 'origin_required' }
    let o: URL
    try {
      o = new URL(r.origin)
    } catch {
      return { code: 403, error: 'origin_not_allowed' }
    }
    if (o.host !== r.host || o.protocol !== (tail ? 'https:' : 'http:') || o.origin !== r.origin) return { code: 403, error: 'origin_not_allowed' }
  }
  if (unsafe) {
    const type = r.type.split(';')[0]!.trim().toLowerCase()
    const want = FORMS.has(r.route) && r.method === 'POST' ? 'multipart/form-data' : 'application/json'
    if (type !== want) return { code: 415, error: 'content_type_not_allowed' }
  }
  return null
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export function read(req: FastifyRequest): Req {
  const h = req.headers
  return {
    method: req.method,
    host: one(h.host) ?? '',
    origin: one(h.origin),
    route: req.routeOptions.url ?? '',
    type: one(h['content-type']) ?? '',
    login: one(h['tailscale-user-login']),
    proxied: 'x-forwarded-for' in h || 'tailscale-user-login' in h || 'x-forwarded-host' in h,
    ws: String(one(h.upgrade) ?? '').toLowerCase() === 'websocket',
  }
}

export function hook(p: Policy) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const v = allow(read(req), p)
    if (v) return reply.code(v.code).send({ error: v.error })
  }
}

export const CSP = [
  "default-src 'self'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ')

export const SANDBOX = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:"

export async function headers(_req: FastifyRequest, reply: FastifyReply) {
  if (!reply.hasHeader('content-security-policy')) reply.header('content-security-policy', CSP)
  reply.header('x-frame-options', 'DENY')
  reply.header('x-content-type-options', 'nosniff')
  reply.header('referrer-policy', 'no-referrer')
  reply.header('cross-origin-opener-policy', 'same-origin')
  reply.header('cross-origin-resource-policy', 'same-origin')
}
