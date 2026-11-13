import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pics } from '../src/chat/pics.ts'
import { form, json, kit, LOCAL, ORIGIN, PNG } from './kit.ts'

const create = (body: object) => JSON.stringify({ network: 'instagram', format: 'feed', title: 'Post', caption: 'Legenda', ...body })

test('cria post e lista por intervalo de datas', async () => {
  const { app } = await kit()
  const a = await app.inject({ method: 'POST', url: '/api/posts', headers: json, body: create({ project: 'mocha.app', title: 'Carrossel do mocha', date: '2026-11-13', time: '12:00' }) })
  assert.equal(a.statusCode, 201)
  const id = a.json().post.id as string
  await app.inject({ method: 'POST', url: '/api/posts', headers: json, body: create({ title: 'Dezembro', date: '2026-12-02' }) })
  await app.inject({ method: 'POST', url: '/api/posts', headers: json, body: create({ title: 'Sem data' }) })

  const nov = await app.inject({ method: 'GET', url: '/api/posts?de=2026-11-01&ate=2026-11-30', headers: { host: LOCAL } })
  assert.deepEqual(nov.json().map((p: { id: string }) => p.id), [id])
  assert.equal((await app.inject({ method: 'GET', url: '/api/posts', headers: { host: LOCAL } })).json().length, 3)
  assert.equal((await app.inject({ method: 'GET', url: '/api/posts?de=0001-01-01&ate=9999-12-31', headers: { host: LOCAL } })).statusCode, 400)
  assert.equal((await app.inject({ method: 'GET', url: '/api/posts?de=2026-02-30&ate=2026-03-01', headers: { host: LOCAL } })).statusCode, 400)

  const one = await app.inject({ method: 'GET', url: `/api/posts/${id}`, headers: { host: LOCAL } })
  assert.equal(one.json().pack.text, 'Legenda')
  assert.ok(one.json().issues.some((i: { code: string }) => i.code === 'media_min'))
})

test('excluir pela rota move a pasta do post para .lixeira, emite gone e o post some da API', async () => {
  const { app, v, bus } = await kit()
  const gone: string[] = []
  bus.on('gone', (e) => gone.push(e.id))
  const { post } = (await app.inject({ method: 'POST', url: '/api/posts', headers: json, body: create({ project: 'mocha.app', title: 'Rascunho descartado', date: '2026-11-16', time: '12:00' }) })).json()
  const up = form('slide.png', 'image/png', PNG)
  const media = (await app.inject({ method: 'POST', url: `/api/posts/${post.id}/media`, ...up, payload: up.body })).json().name as string

  const del = await app.inject({ method: 'DELETE', url: `/api/posts/${post.id}`, headers: json, body: '{}' })
  assert.equal(del.statusCode, 200)
  assert.deepEqual(gone, [post.id])
  assert.deepEqual(await readdir(v.repo.dir), [])
  const [moved] = await readdir(join(v.dir, '.lixeira'))
  assert.ok(moved?.startsWith(`${post.id}-`))
  assert.deepEqual((await readdir(join(v.dir, '.lixeira', moved))).sort(), [media, 'post.md'].sort())

  assert.equal((await app.inject({ method: 'GET', url: `/api/posts/${post.id}`, headers: { host: LOCAL } })).statusCode, 404)
  assert.deepEqual((await app.inject({ method: 'GET', url: '/api/posts', headers: { host: LOCAL } })).json(), [])
  const slots = (await app.inject({ method: 'GET', url: '/api/slots?de=2026-11-16&ate=2026-11-16', headers: { host: LOCAL } })).json()
  assert.equal(slots.find((s: { time: string }) => s.time === '12:00').post, null)
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/posts/${post.id}`, headers: json, body: '{}' })).statusCode, 404)
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/posts/..%2F..%2Fconfig.json', headers: json, body: '{}' })).statusCode, 400)
  assert.deepEqual(gone, [post.id])
})

test('PATCH aceita só campos conhecidos e status muda pela rota de status', async () => {
  const { app } = await kit()
  const { post } = (await app.inject({ method: 'POST', url: '/api/posts', headers: json, body: create({}) })).json()
  const bad = await app.inject({ method: 'PATCH', url: `/api/posts/${post.id}`, headers: json, body: JSON.stringify({ status: 'posted', postedAt: 'x' }) })
  assert.equal(bad.statusCode, 400)
  const stale = await app.inject({ method: 'PATCH', url: `/api/posts/${post.id}`, headers: json, body: JSON.stringify({ base: '2020-01-01T00:00:00.000Z', caption: 'y' }) })
  assert.equal(stale.statusCode, 409)
  const ready = await app.inject({ method: 'POST', url: `/api/posts/${post.id}/status`, headers: json, body: JSON.stringify({ to: 'ready' }) })
  assert.equal(ready.statusCode, 422)
})

test('upload: mime proibido, SVG disfarçado e id com ../ são recusados; PNG entra e é servido com tipo do servidor', async () => {
  const { app } = await kit()
  const { post } = (await app.inject({ method: 'POST', url: '/api/posts', headers: json, body: create({}) })).json()
  const url = `/api/posts/${post.id}/media`

  const svg = form('x.svg', 'image/svg+xml', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))
  assert.equal((await app.inject({ method: 'POST', url, ...svg, payload: svg.body })).statusCode, 400)

  const fake = form('x.png', 'image/png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))
  assert.equal((await app.inject({ method: 'POST', url, ...fake, payload: fake.body })).statusCode, 400)

  const traversal = form('x.png', 'image/png', PNG)
  assert.equal((await app.inject({ method: 'POST', url: '/api/posts/..%2F..%2Fetc/media', ...traversal, payload: traversal.body })).statusCode, 400)

  const ok = form('../../evil name.png', 'image/png', PNG)
  const up = await app.inject({ method: 'POST', url, ...ok, payload: ok.body })
  assert.equal(up.statusCode, 201)
  const name = up.json().name as string
  assert.match(name, /^m-[0-9a-f]{10}\.png$/)
  assert.deepEqual(up.json().post.media, [name])

  const got = await app.inject({ method: 'GET', url: `${url}/${name}`, headers: { host: LOCAL } })
  assert.equal(got.statusCode, 200)
  assert.equal(got.headers['content-type'], 'image/png')
  assert.equal(got.headers['x-content-type-options'], 'nosniff')
  assert.equal(got.rawPayload.length, PNG.length)

  assert.equal((await app.inject({ method: 'GET', url: `${url}/..%2F..%2Fconfig.json`, headers: { host: LOCAL } })).statusCode, 404)
})

test('config: nome de skill com ../ e pasta de projetos na home são recusados', async () => {
  const { app, home } = await kit()
  const cur = (await app.inject({ method: 'GET', url: '/api/config', headers: { host: LOCAL } })).json().config
  const put = (c: object) => app.inject({ method: 'PUT', url: '/api/config', headers: json, body: JSON.stringify(c) })
  assert.equal((await put({ ...cur, skills: ['../../.ssh/x'] })).statusCode, 400)
  assert.equal((await put({ ...cur, root: home })).statusCode, 400)
  assert.equal((await put({ ...cur, root: '/' })).statusCode, 400)
  assert.equal((await put({ ...cur, rules: [{ net: 'linkedin', format: 'reels', days: [0], times: ['12:00'], on: true }] })).statusCode, 400)
  assert.equal((await put({ ...cur, push: { ...cur.push, before: 30 } })).statusCode, 200)
})

test('slots por intervalo e projetos com contagem', async () => {
  const { app } = await kit()
  await app.inject({ method: 'POST', url: '/api/posts', headers: json, body: create({ project: 'mocha.app', date: '2026-11-16', time: '12:00' }) })
  const s = (await app.inject({ method: 'GET', url: '/api/slots?de=2026-11-16&ate=2026-11-17', headers: { host: LOCAL } })).json()
  assert.equal(s.length, 3)
  assert.ok(s[0].post)
  const projects = (await app.inject({ method: 'GET', url: '/api/projects', headers: { host: LOCAL } })).json()
  const mocha = projects.find((p: { id: string }) => p.id === 'mocha.app')
  assert.equal(mocha.stats.draft, 1)
  assert.ok(projects.some((p: { id: string }) => p.id === 'geral'))
})

test('imagem do chat: PNG sobe e é servido pelo nome do hash; SVG disfarçado, JSON e outra origem são recusados', async () => {
  const { app, base } = await kit()
  const { app: chat } = await kit({ pics: pics(join(base, 'pics')) })
  const url = '/api/chat/images'
  const png = form('print da tela.png', 'image/png', PNG)
  assert.equal((await app.inject({ method: 'POST', url, ...png, payload: png.body })).statusCode, 429)
  const up = await chat.inject({ method: 'POST', url, ...png, payload: png.body })
  assert.equal(up.statusCode, 201)
  const name = up.json().name as string
  assert.match(name, /^[0-9a-f]{24}\.png$/)
  const again = await chat.inject({ method: 'POST', url, ...png, payload: png.body })
  assert.equal(again.json().name, name)
  const got = await chat.inject({ method: 'GET', url: `${url}/${name}`, headers: { host: LOCAL } })
  assert.equal(got.statusCode, 200)
  assert.equal(got.headers['content-type'], 'image/png')
  assert.equal(got.rawPayload.length, PNG.length)

  const svg = form('x.png', 'image/png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))
  assert.equal((await chat.inject({ method: 'POST', url, ...svg, payload: svg.body })).statusCode, 400)
  assert.equal((await chat.inject({ method: 'POST', url, headers: json, body: '{}' })).statusCode, 415)
  const evil = form('x.png', 'image/png', PNG)
  assert.equal((await chat.inject({ method: 'POST', url, headers: { ...evil.headers, origin: 'http://evil.com' }, payload: evil.body })).statusCode, 403)
  assert.equal((await chat.inject({ method: 'GET', url: `${url}/..%2F..%2Fpush.json`, headers: { host: LOCAL } })).statusCode, 400)
  assert.equal((await chat.inject({ method: 'GET', url: `${url}/${'0'.repeat(24)}.png`, headers: { host: LOCAL, origin: ORIGIN } })).statusCode, 404)
})
