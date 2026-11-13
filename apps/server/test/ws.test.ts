import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Wire } from '@social-grid/core/chat.ts'
import type WebSocket from 'ws'
import { json, kit, LOCAL, ORIGIN, TAIL } from './kit.ts'

const PHONE = '100.101.102.103'

function inbox(ws: WebSocket) {
  const got: Wire[] = []
  ws.on('message', (m) => got.push(JSON.parse(String(m)) as Wire))
  const peers = async (want: string[]) => {
    for (let i = 0; i < 100; i++) {
      const last = got.filter((m) => m.t === 'peers').at(-1)
      if (last && JSON.stringify(last.list) === JSON.stringify(want)) return
      await new Promise((r) => setTimeout(r, 10))
    }
    assert.fail(`a pílula não chegou a ${JSON.stringify(want)}: ${JSON.stringify(got)}`)
  }
  return { got, peers }
}

test('pílula do topo: o PC vê o nome do celular que conectou pela tailnet e volta a "só este PC" quando ele sai', async () => {
  const asked: string[] = []
  const { app } = await kit({
    who: async (ip) => {
      asked.push(ip)
      return ip === PHONE ? 'moto-g24' : null
    },
  })
  await app.ready()
  let box!: ReturnType<typeof inbox>
  const pc = await app.injectWS('/ws', { headers: { host: LOCAL, origin: ORIGIN } }, { onInit: (ws) => (box = inbox(ws)) })
  try {
    await box.peers([])

    const phone = await app.injectWS('/ws', {
      headers: { host: TAIL, origin: `https://${TAIL}`, 'tailscale-user-login': 'valb@github', 'x-forwarded-for': `${PHONE}, 127.0.0.1` },
    })
    await box.peers(['moto-g24'])
    assert.deepEqual(asked, [PHONE])

    const other = await app.injectWS('/ws', { headers: { host: TAIL, origin: `https://${TAIL}`, 'tailscale-user-login': 'valb@github', 'x-forwarded-for': '100.64.0.9' } })
    await new Promise((r) => setTimeout(r, 30))
    await box.peers(['moto-g24'])

    phone.terminate()
    await box.peers([])
    other.terminate()
  } finally {
    pc.terminate()
    await app.close()
  }
})

test('celular sem o login do dono na tailnet não abre o WebSocket', async () => {
  const { app } = await kit({ who: async () => 'intruso' })
  await app.ready()
  await assert.rejects(app.injectWS('/ws', { headers: { host: TAIL, origin: `https://${TAIL}`, 'tailscale-user-login': 'outro@github', 'x-forwarded-for': PHONE } }), /403/)
  await app.close()
})

test('post excluído no PC some ao vivo no celular: a segunda conexão recebe gone', async () => {
  const { app } = await kit({ who: async () => 'moto-g24' })
  await app.ready()
  const { post } = (await app.inject({ method: 'POST', url: '/api/posts', headers: json, body: JSON.stringify({ network: 'instagram', format: 'feed', title: 'Rascunho' }) })).json()
  let pc!: ReturnType<typeof inbox>
  let phone!: ReturnType<typeof inbox>
  const a = await app.injectWS('/ws', { headers: { host: LOCAL, origin: ORIGIN } }, { onInit: (ws) => (pc = inbox(ws)) })
  const b = await app.injectWS('/ws', { headers: { host: TAIL, origin: `https://${TAIL}`, 'tailscale-user-login': 'valb@github', 'x-forwarded-for': PHONE } }, { onInit: (ws) => (phone = inbox(ws)) })
  try {
    await pc.peers(['moto-g24'])
    assert.equal((await app.inject({ method: 'DELETE', url: `/api/posts/${post.id}`, headers: json, body: '{}' })).statusCode, 200)
    for (let i = 0; i < 100 && !phone.got.some((m) => m.t === 'gone'); i++) await new Promise((r) => setTimeout(r, 10))
    assert.deepEqual(phone.got.filter((m) => m.t === 'gone'), [{ t: 'gone', id: post.id }])
    assert.deepEqual(pc.got.filter((m) => m.t === 'gone'), [{ t: 'gone', id: post.id }])
  } finally {
    a.terminate()
    b.terminate()
    await app.close()
  }
})
