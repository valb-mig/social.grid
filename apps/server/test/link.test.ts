import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { policy } from '../src/guard.ts'
import { Block, link } from '../src/link.ts'
import type { Serve } from '../src/link.ts'
import type { Status } from '../src/tailnet.ts'
import { json, kit, LOCAL, TAIL } from './kit.ts'

const STATUS = JSON.parse(readFileSync(new URL('./tailscale/status.json', import.meta.url), 'utf8')) as Status
const SERVE = JSON.parse(readFileSync(new URL('./tailscale/serve.json', import.meta.url), 'utf8')) as Serve
const ON = ['serve', '--bg', '--https=8443', '7338']
const OFF = ['serve', '--https=8443', 'off']

type Fake = { status?: Status | 'missing' | 'down'; serve?: Serve; fail?: { stderr: string } }

function without(s: Serve, port: string): Serve {
  const c = structuredClone(s)
  delete c.TCP?.[port]
  for (const k of Object.keys(c.Web ?? {})) if (k.endsWith(`:${port}`)) delete c.Web?.[k]
  return c
}

function pointing(s: Serve, port: string, proxy: string): Serve {
  const c = structuredClone(s)
  c.TCP![port] = { HTTPS: true }
  c.Web![`pc.tail1234.ts.net:${port}`] = { Handlers: { '/': { Proxy: proxy } } }
  return c
}

function fake(f: Fake = {}) {
  const calls: string[][] = []
  const state = { serve: f.serve ?? SERVE, status: f.status ?? STATUS, fail: f.fail }
  const exec = async (args: string[]) => {
    calls.push(args)
    const s = state.status
    if (s === 'missing') throw Object.assign(new Error('spawn tailscale ENOENT'), { code: 'ENOENT' })
    if (args[0] === 'status') return JSON.stringify(s === 'down' ? { ...STATUS, BackendState: 'Stopped' } : s)
    if (s === 'down') throw Object.assign(new Error('falhou'), { stderr: 'failed to connect to local tailscaled; it doesn’t appear to be running' })
    if (args.join(' ') === 'serve status --json') return JSON.stringify(state.serve)
    if (state.fail) throw Object.assign(new Error('Command failed'), state.fail)
    if (args.join(' ') === ON.join(' ')) state.serve = pointing(state.serve, '8443', 'http://127.0.0.1:7338')
    if (args.join(' ') === OFF.join(' ')) state.serve = without(state.serve, '8443')
    return ''
  }
  const writes = () => calls.filter((a) => a[0] === 'serve' && a[1] !== 'status')
  return { exec, calls, writes, state }
}

const make = (exec: (args: string[]) => Promise<string>, extra = {}) => link({ exec, port: 7338, serve: 8443, user: 'valb', ...extra })

test('status real do tailscale com outras portas publicadas: a 8443 já leva ao app, com link e só os celulares do dono', async () => {
  const f = fake()
  const c = await make(f.exec).check(true)
  assert.equal(c.tailscale, 'running')
  assert.equal(c.login, 'valb@github')
  assert.equal(c.dns, true)
  assert.equal(c.https, true)
  assert.equal(c.state, 'on')
  assert.equal(c.target, 'http://127.0.0.1:7338')
  assert.equal(c.url, 'https://pc.tail1234.ts.net:8443')
  assert.deepEqual(c.phones, [
    { name: 'moto-g24', os: 'Android', online: true },
    { name: 'iphone-de-valb', os: 'iOS', online: false },
  ])
  assert.deepEqual(c.todo, [])
  assert.deepEqual(f.writes(), [])
})

test('com a 8443 já apontando para o app, publicar não roda nada de escrita', async () => {
  const f = fake()
  assert.equal(await make(f.exec).on(), false)
  assert.deepEqual(f.writes(), [])
})

test('8443 livre: publicar roda o serve com os args exatos e libera o celular no guard na hora', async () => {
  const f = fake({ serve: without(SERVE, '8443') })
  const p = policy(['127.0.0.1:7338'])
  const l = make(f.exec, { policy: p })
  assert.equal((await l.check(true)).state, 'off')
  assert.equal(await l.on(), true)
  assert.deepEqual(f.writes(), [ON])
  assert.deepEqual([...p.tailnet], ['pc.tail1234.ts.net:8443'])
  assert.deepEqual([...p.logins], ['valb@github'])
  assert.equal((await l.check(true)).state, 'on')
})

test('desligar tira só a 8443 do app e não mexe no serve de outro app', async () => {
  const f = fake()
  const l = make(f.exec)
  assert.equal(await l.off(), true)
  assert.deepEqual(f.writes(), [OFF])
  assert.equal(await l.off(), false)
  assert.deepEqual(f.writes(), [OFF])

  const g = fake({ serve: pointing(SERVE, '8443', 'http://127.0.0.1:9000') })
  assert.equal(await make(g.exec).off(), false)
  assert.deepEqual(g.writes(), [])
})

test('8443 levando a outro serviço: não sobrescreve e diz o que está lá', async () => {
  const f = fake({ serve: pointing(SERVE, '8443', 'http://127.0.0.1:9000') })
  const l = make(f.exec)
  await assert.rejects(l.on(), (e: unknown) => e instanceof Block && e.todo.id === 'busy' && e.todo.text.includes('http://127.0.0.1:9000'))
  assert.deepEqual(f.writes(), [])
  const c = await l.check(true)
  assert.equal(c.state, 'busy')
  assert.deepEqual(
    c.todo.map((t) => t.id),
    ['busy'],
  )
})

test('sem operator o erro vira o comando exato com o usuário do PC e fica no status até dar certo', async () => {
  const f = fake({ serve: without(SERVE, '8443'), fail: { stderr: 'Access denied: serve config denied\nUse \'sudo tailscale serve\' or set operator' } })
  const l = make(f.exec)
  await assert.rejects(l.on(), (e: unknown) => e instanceof Block && e.todo.id === 'operator' && e.todo.cmd === 'sudo tailscale set --operator=valb')
  const c = await l.check(true)
  assert.equal(c.todo[0]?.id, 'operator')
  f.state.fail = undefined
  assert.equal(await l.on(), true)
  assert.deepEqual(
    (await l.check(true)).todo.map((t) => t.id),
    [],
  )
})

test('HTTPS ou MagicDNS desligados na tailnet: não tenta publicar e aponta o painel de DNS', async () => {
  const f = fake({ serve: without(SERVE, '8443'), status: { ...STATUS, CertDomains: null } })
  const l = make(f.exec)
  await assert.rejects(l.on(), (e: unknown) => e instanceof Block && e.todo.id === 'https' && !!e.todo.links?.[0]?.href.includes('/admin/dns'))
  assert.deepEqual(f.writes(), [])
  assert.deepEqual(
    (await l.check(true)).todo.map((t) => t.id),
    ['https'],
  )

  const g = fake({ serve: without(SERVE, '8443'), status: { ...STATUS, CurrentTailnet: { MagicDNSEnabled: false } } })
  await assert.rejects(make(g.exec).on(), (e: unknown) => e instanceof Block && e.todo.id === 'dns')
  assert.deepEqual(g.writes(), [])
})

test('Tailscale ausente ou parado aparece no status sem quebrar', async () => {
  const missing = await make(fake({ status: 'missing' }).exec).check(true)
  assert.equal(missing.tailscale, 'missing')
  assert.deepEqual(
    missing.todo.map((t) => t.id),
    ['missing'],
  )
  assert.equal(missing.url, null)

  const down = await make(fake({ status: 'down' }).exec).check(true)
  assert.equal(down.tailscale, 'stopped')
  assert.equal(down.todo[0]?.cmd, 'sudo tailscale up')
})

test('sem celular do dono na tailnet, o status pede para instalar o Tailscale no celular', async () => {
  const s = structuredClone(STATUS)
  for (const p of Object.values(s.Peer ?? {})) if (/android|ios/i.test(p.OS ?? '')) p.UserID = 230000000000001
  const c = await make(fake({ status: s }).exec).check(true)
  assert.deepEqual(c.phones, [])
  assert.equal(c.todo.at(-1)?.id, 'phone')
  assert.match(c.todo.at(-1)!.text, /valb@github/)
})

test('boot com phone.link ligado publica uma vez; desligado não publica', async () => {
  const f = fake({ serve: without(SERVE, '8443') })
  const l = make(f.exec)
  assert.equal(await l.boot(true), 'new')
  assert.equal(await l.boot(true), null)
  assert.deepEqual(f.writes(), [ON])

  const g = fake({ serve: without(SERVE, '8443') })
  const m = make(g.exec)
  assert.equal(await m.boot(false), 'off')
  assert.equal(await m.boot(true), null)
  assert.deepEqual(g.writes(), [])
})

test('boot espera o Tailscale subir e publica quando ele aparece; porta ocupada só fica no status', async () => {
  const f = fake({ serve: without(SERVE, '8443'), status: 'down' })
  const l = make(f.exec)
  assert.equal(await l.boot(true), 'wait')
  assert.deepEqual(f.writes(), [])
  f.state.status = STATUS
  assert.equal(await l.boot(true), 'new')
  assert.deepEqual(f.writes(), [ON])

  const g = fake({ serve: pointing(SERVE, '8443', 'http://127.0.0.1:9000') })
  assert.equal(await make(g.exec).boot(true), 'busy')
  assert.deepEqual(g.writes(), [])
})

test('POST /api/link: pela tailnet é 403, no PC desliga, grava a config e o GET mostra o estado', async () => {
  const f = fake()
  const { app, v } = await kit({ link: make(f.exec) })
  const tail = { host: TAIL, origin: `https://${TAIL}`, 'content-type': 'application/json', 'tailscale-user-login': 'valb@github' }

  const remote = await app.inject({ method: 'POST', url: '/api/link', headers: tail, body: JSON.stringify({ on: false }) })
  assert.equal(remote.statusCode, 403)
  assert.equal(remote.json().error, 'local_only')
  assert.deepEqual(f.writes(), [])
  assert.equal((await v.cfg.load()).phone.link, true)

  const seen = await app.inject({ method: 'GET', url: '/api/link', headers: { host: TAIL, 'tailscale-user-login': 'valb@github' } })
  assert.equal(seen.statusCode, 200)
  assert.equal(seen.json().local, false)
  assert.equal(seen.json().url, 'https://pc.tail1234.ts.net:8443')

  const off = await app.inject({ method: 'POST', url: '/api/link', headers: json, body: JSON.stringify({ on: false }) })
  assert.equal(off.statusCode, 200)
  assert.equal(off.json().state, 'off')
  assert.equal(off.json().want, false)
  assert.equal(off.json().local, true)
  assert.deepEqual(f.writes(), [OFF])
  assert.equal((await v.cfg.load()).phone.link, false)

  const on = await app.inject({ method: 'POST', url: '/api/link', headers: json, body: JSON.stringify({ on: true }) })
  assert.equal(on.json().state, 'on')
  assert.deepEqual(f.writes(), [OFF, ON])

  assert.equal((await app.inject({ method: 'POST', url: '/api/link', headers: json, body: JSON.stringify({ on: 'sim' }) })).statusCode, 400)
  assert.equal((await app.inject({ method: 'GET', url: '/api/link', headers: { host: LOCAL } })).json().local, true)
})

test('POST /api/link com a porta ocupada responde 409 com a mensagem; PUT da config não liga nem desliga o link', async () => {
  const f = fake({ serve: pointing(SERVE, '8443', 'http://127.0.0.1:9000') })
  const { app, v } = await kit({ link: make(f.exec) })
  const r = await app.inject({ method: 'POST', url: '/api/link', headers: json, body: JSON.stringify({ on: true }) })
  assert.equal(r.statusCode, 409)
  assert.equal(r.json().error, 'busy')
  assert.match(r.json().message, /127\.0\.0\.1:9000/)

  const cfg = await v.cfg.load()
  await app.inject({ method: 'PUT', url: '/api/config', headers: json, body: JSON.stringify({ ...cfg, phone: { link: false } }) })
  assert.equal((await v.cfg.load()).phone.link, true)
  assert.deepEqual(f.writes(), [])
})
