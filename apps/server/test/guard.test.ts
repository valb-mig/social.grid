import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allow, policy, type Req } from '../src/guard.ts'
import { sub } from '../src/push/push.ts'
import { json, kit, LOCAL, ORIGIN, TAIL } from './kit.ts'

const pol = () => {
  const p = policy([LOCAL])
  p.tailnet = new Set([TAIL])
  p.logins = new Set(['valb@github'])
  return p
}
const req = (r: Partial<Req>): Req => ({ method: 'GET', host: LOCAL, route: '/api/posts', type: '', proxied: false, ws: false, ...r })

test('guard puro: host, origem, tipo do corpo, WebSocket e login da tailnet', () => {
  const p = pol()
  assert.equal(allow(req({}), p), null)
  assert.equal(allow(req({ host: 'evil.com' }), p)?.error, 'host_not_allowed')
  assert.equal(allow(req({ host: '127.0.0.1:9999' }), p)?.error, 'host_not_allowed')
  assert.equal(allow(req({ method: 'POST', origin: 'http://evil.com', type: 'application/json' }), p)?.error, 'origin_not_allowed')
  assert.equal(allow(req({ method: 'POST', type: 'application/json' }), p)?.error, 'origin_required')
  assert.equal(allow(req({ method: 'POST', origin: 'null', type: 'application/json' }), p)?.error, 'origin_required')
  assert.equal(allow(req({ method: 'POST', origin: 'https://127.0.0.1:7338', type: 'application/json' }), p)?.error, 'origin_not_allowed')
  assert.equal(allow(req({ method: 'POST', origin: ORIGIN, type: 'text/plain' }), p)?.error, 'content_type_not_allowed')
  assert.equal(allow(req({ method: 'POST', origin: ORIGIN, type: 'application/json' }), p), null)
  assert.equal(allow(req({ method: 'POST', origin: ORIGIN, type: 'multipart/form-data; boundary=x' }), p)?.error, 'content_type_not_allowed')
  assert.equal(allow(req({ method: 'POST', route: '/api/posts/:id/media', origin: ORIGIN, type: 'multipart/form-data; boundary=x' }), p), null)
  assert.equal(allow(req({ route: '/ws', ws: true }), p)?.error, 'origin_required')
  assert.equal(allow(req({ route: '/ws', ws: true, origin: 'http://evil.com' }), p)?.error, 'origin_not_allowed')
  assert.equal(allow(req({ route: '/ws', ws: true, origin: ORIGIN }), p), null)
  assert.equal(allow(req({ host: TAIL, proxied: true }), p)?.error, 'tailnet_identity_required')
  assert.equal(allow(req({ host: TAIL, proxied: true, login: 'outro@github' }), p)?.error, 'tailnet_identity_required')
  assert.equal(allow(req({ host: TAIL, proxied: true, login: 'valb@github' }), p), null)
  assert.equal(allow(req({ host: TAIL, proxied: true, login: 'valb@github', method: 'POST', origin: `https://${TAIL}`, type: 'application/json' }), p), null)
  assert.equal(allow(req({ host: 'pc.tail1234.ts.net:9999', proxied: true, login: 'valb@github' }), p)?.error, 'host_not_allowed')
  assert.equal(allow(req({ proxied: true, login: 'valb@github' }), p)?.error, 'tailnet_identity_required')
})

test('guard no servidor: Host evil.com, POST de outra origem e WebSocket de outra origem são recusados', async () => {
  const { app } = await kit()
  assert.equal((await app.inject({ method: 'GET', url: '/api/posts', headers: { host: 'evil.com' } })).statusCode, 403)
  assert.equal((await app.inject({ method: 'GET', url: '/api/posts', headers: { host: LOCAL } })).statusCode, 200)
  const body = JSON.stringify({ network: 'instagram', format: 'feed', title: 'x' })
  assert.equal((await app.inject({ method: 'POST', url: '/api/posts', headers: { ...json, origin: 'http://evil.com' }, body })).statusCode, 403)
  assert.equal((await app.inject({ method: 'POST', url: '/api/posts', headers: { host: LOCAL, 'content-type': 'application/json' }, body })).statusCode, 403)
  assert.equal((await app.inject({ method: 'POST', url: '/%61pi/posts', headers: { ...json, origin: 'http://evil.com' }, body })).statusCode, 403)
  assert.equal((await app.inject({ method: 'POST', url: '/api/posts', headers: { ...json, 'content-type': 'text/plain' }, body })).statusCode, 415)
  const ws = { host: LOCAL, connection: 'upgrade', upgrade: 'websocket', 'sec-websocket-version': '13', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==' }
  assert.equal((await app.inject({ method: 'GET', url: '/ws', headers: { ...ws, origin: 'http://evil.com' } })).statusCode, 403)
  assert.equal((await app.inject({ method: 'GET', url: '/ws', headers: ws })).statusCode, 403)
})

test('DELETE sem Origin, de outra origem ou sem JSON é recusado e o post continua lá', async () => {
  const { app } = await kit()
  const { post } = (await app.inject({ method: 'POST', url: '/api/posts', headers: json, body: JSON.stringify({ network: 'instagram', format: 'feed', title: 'x' }) })).json()
  const url = `/api/posts/${post.id}`
  assert.equal((await app.inject({ method: 'DELETE', url, headers: { host: LOCAL, 'content-type': 'application/json' }, body: '{}' })).statusCode, 403)
  assert.equal((await app.inject({ method: 'DELETE', url, headers: { host: LOCAL } })).statusCode, 403)
  assert.equal((await app.inject({ method: 'DELETE', url, headers: { ...json, origin: 'null' }, body: '{}' })).statusCode, 403)
  assert.equal((await app.inject({ method: 'DELETE', url, headers: { ...json, origin: 'http://evil.com' }, body: '{}' })).statusCode, 403)
  assert.equal((await app.inject({ method: 'DELETE', url, headers: { ...json, 'content-type': 'text/plain' }, body: '{}' })).statusCode, 415)
  const tail = { host: TAIL, origin: `https://${TAIL}`, 'content-type': 'application/json' }
  assert.equal((await app.inject({ method: 'DELETE', url, headers: { ...tail, 'tailscale-user-login': 'outro@github' }, body: '{}' })).statusCode, 403)
  assert.equal((await app.inject({ method: 'GET', url, headers: { host: LOCAL } })).statusCode, 200)
  assert.equal((await app.inject({ method: 'DELETE', url, headers: { ...tail, 'tailscale-user-login': 'valb@github' }, body: '{}' })).statusCode, 200)
  assert.equal((await app.inject({ method: 'GET', url, headers: { host: LOCAL } })).statusCode, 404)
})

test('respostas saem com CSP, X-Frame-Options e nosniff', async () => {
  const { app } = await kit()
  const r = await app.inject({ method: 'GET', url: '/api/posts', headers: { host: LOCAL } })
  assert.match(String(r.headers['content-security-policy']), /frame-ancestors 'none'/)
  assert.equal(r.headers['x-frame-options'], 'DENY')
  assert.equal(r.headers['x-content-type-options'], 'nosniff')
})

test('inscrição de push só para serviço de push conhecido e em https', () => {
  const keys = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) }
  assert.equal(sub.safeParse({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys }).success, true)
  assert.equal(sub.safeParse({ endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/x', keys }).success, true)
  assert.equal(sub.safeParse({ endpoint: 'https://169.254.169.254/latest', keys }).success, false)
  assert.equal(sub.safeParse({ endpoint: 'http://fcm.googleapis.com/fcm/send/abc', keys }).success, false)
  assert.equal(sub.safeParse({ endpoint: 'https://fcm.googleapis.com.evil.com/x', keys }).success, false)
  assert.equal(sub.safeParse({ endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'x', auth: 'y' } }).success, false)
})
