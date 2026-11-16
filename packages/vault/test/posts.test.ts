import assert from 'node:assert/strict'
import { lstat, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { bus } from '@social-grid/core/bus.ts'
import { Fault } from '@social-grid/core/fault.ts'
import { defaults } from '@social-grid/core/plan/config.ts'
import { ops } from '@social-grid/core/post/ops.ts'
import { decode, encode, posts } from '../src/posts.ts'

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')
const now = () => new Date('2026-11-13T10:00:00')

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'sg-vault-'))
  const repo = posts(dir)
  const cfg = { ...defaults(), tags: { nets: { instagram: ['buildinpublic'], linkedin: [] }, projects: { 'mocha.app': ['mcp'] } } }
  return { dir, repo, o: ops({ repo, config: async () => cfg, bus: bus(), now }) }
}

test('criar, anexar mídia, mudar a data e reler do disco preserva mídia e campos', async () => {
  const { dir, repo, o } = await setup()
  const caption = 'Seu design ainda mora em print solto?\n---\nlinha com três traços no meio'
  const { post } = await o.create({ project: 'mocha.app', network: 'instagram', format: 'carrossel', title: 'Carrossel: design por ideia', caption, hashtags: ['#devbrasil'], date: '2026-11-13', time: '12:00' })
  assert.match(post.id, /^carrossel-design-por-ideia-[a-z0-9]{4}$/)
  assert.deepEqual(post.hashtags, ['devbrasil', 'buildinpublic', 'mcp'])

  const src = join(dir, 'slide.png')
  await writeFile(src, PNG)
  const { name } = await o.attach(post.id, src, 'png')
  await o.patch(post.id, { date: '2026-11-20' })

  const again = await posts(dir).get(post.id)
  assert.ok(again)
  assert.equal(again.date, '2026-11-20')
  assert.equal(again.time, '12:00')
  assert.equal(again.caption, caption)
  assert.equal(again.title, 'Carrossel: design por ideia')
  assert.deepEqual(again.media, [name])
  assert.ok(await repo.file(post.id, name))

  const md = await readFile(join(dir, 'posts', post.id, 'post.md'), 'utf8')
  assert.ok(md.startsWith(`---\nid: ${post.id}\nproject: mocha.app\nnetwork: instagram\nformat: carrossel\nstatus: draft\ndate: 2026-11-20\ntime: 12:00\ntitle: "Carrossel: design por ideia"\n`), md)
  assert.ok(md.endsWith(`---\n\n${caption}\n`))
})

test('título com quebra e "---" não injeta campo no frontmatter', async () => {
  const { dir, o } = await setup()
  const { post } = await o.create({ network: 'instagram', format: 'feed', title: 'oi\n---\nstatus: posted', caption: 'x' })
  const again = await posts(dir).get(post.id)
  assert.equal(again?.status, 'draft')
  assert.equal(again?.project, 'geral')
})

test('mídia e id com ../ não saem da pasta do post', async () => {
  const { repo, o } = await setup()
  const { post } = await o.create({ network: 'instagram', format: 'feed', title: 'a', caption: 'x' })
  assert.equal(await repo.file(post.id, '../../config.json'), null)
  assert.equal(await repo.file('../posts', 'post.md'), null)
  assert.equal(await repo.get('../../etc'), null)
  await assert.rejects(o.patch(post.id, { media: ['../../../.ssh/id_ed25519'] }), (e) => e instanceof Fault && e.code === 'invalid')
})

test('edição com updatedAt velho é recusada em vez de apagar a do outro processo', async () => {
  const { o } = await setup()
  const { post } = await o.create({ network: 'instagram', format: 'feed', title: 'a', caption: 'x' })
  const base = post.updatedAt
  await o.patch(post.id, { caption: 'mudou no terminal' })
  await assert.rejects(o.patch(post.id, { caption: 'mudou no app' }, base), (e) => e instanceof Fault && e.code === 'conflict')
})

test('duas edições simultâneas no mesmo post não se perdem', async () => {
  const { o } = await setup()
  const { post } = await o.create({ network: 'instagram', format: 'feed', title: 'a', caption: 'x' })
  await Promise.all([o.patch(post.id, { caption: 'legenda nova' }), o.patch(post.id, { time: '18:00' })])
  const r = await o.get(post.id)
  assert.equal(r.post.caption, 'legenda nova')
  assert.equal(r.post.time, '18:00')
})

const FULL = `---
id: briefing-obsidian-k2l3
project: mocha.app
network: linkedin
format: post
type: bastidores técnico
status: ready
date: 2026-11-19
time: 08:30
title: Por que o blend é HTML puro
hashtags:
  - buildinpublic
  - devbrasil
media:
  - m-25984c648e.jpg
comment: https://github.com/valb-mig/mocha
postedAt: null
createdAt: 2026-11-10T15:00:00.000Z
updatedAt: 2026-11-12T15:00:00.000Z
---

Gancho do post.
`

test('post.md sem algum campo continua no app, com o campo no padrão', () => {
  const mtime = new Date('2026-11-12T18:00:00.000Z')
  const whole = decode('briefing-obsidian-k2l3', FULL, mtime)
  assert.ok(whole)
  assert.equal(whole.type, 'bastidores técnico')
  const fields = ['project', 'network', 'format', 'type', 'status', 'date', 'time', 'title', 'hashtags', 'media', 'comment', 'postedAt', 'createdAt', 'updatedAt']
  const fallback: Record<string, unknown> = {
    project: 'geral',
    network: 'instagram',
    format: 'feed',
    type: '',
    status: 'draft',
    date: null,
    time: null,
    title: 'briefing-obsidian-k2l3',
    hashtags: [],
    media: [],
    comment: '',
    postedAt: null,
    createdAt: mtime.toISOString(),
    updatedAt: mtime.toISOString(),
  }
  for (const f of fields) {
    const raw = FULL.split('\n').filter((l, i, all) => !l.startsWith(`${f}:`) && !(l.startsWith('  - ') && all.slice(0, i).reverse().find((x) => !x.startsWith('  - '))?.startsWith(`${f}:`))).join('\n')
    const p = decode('briefing-obsidian-k2l3', raw, mtime)
    assert.ok(p, `sem ${f} o post sumiu`)
    const want = f === 'format' ? 'post' : fallback[f]
    assert.deepEqual(p[f as keyof typeof p], want, f)
    assert.equal(p.caption, 'Gancho do post.')
  }
})

test('post.md mínimo escrito à mão vira rascunho do Instagram e entra na lista', async () => {
  const { dir, repo } = await setup()
  const folder = join(dir, 'posts', 'ideia-solta-m4n5')
  await mkdir(folder, { recursive: true })
  await writeFile(join(folder, 'post.md'), '---\ntitle: Ideia solta\ndate: 2026-11-20\nhashtags: [devbrasil, 2026]\n---\nTexto escrito no editor.\n')
  const [p] = await repo.list()
  assert.ok(p)
  assert.equal(p.id, 'ideia-solta-m4n5')
  assert.equal(p.title, 'Ideia solta')
  assert.equal(p.network, 'instagram')
  assert.equal(p.format, 'feed')
  assert.equal(p.status, 'draft')
  assert.equal(p.date, '2026-11-20')
  assert.deepEqual(p.hashtags, ['devbrasil', '2026'])
  assert.equal(p.caption, 'Texto escrito no editor.')
  const again = decode(p.id, encode(p), new Date())
  assert.deepEqual({ ...again, updatedAt: p.updatedAt, createdAt: p.createdAt }, p)
})

test('rede e formato desconhecidos voltam ao padrão da rede em vez de quebrar a validação', () => {
  const p = decode('x-abcd', '---\nnetwork: mastodon\nformat: toot\ntitle: x\n---\n', new Date())
  assert.equal(p?.network, 'instagram')
  assert.equal(p?.format, 'feed')
  const t = decode('t-abcd', '---\nnetwork: tiktok\nformat: dueto\ntitle: t\n---\n', new Date())
  assert.equal(t?.network, 'tiktok')
  assert.equal(t?.format, 'video')
  const q = decode('y-abcd', '---\nnetwork: linkedin\nformat: reels\ntitle: y\n---\n', new Date())
  assert.equal(q?.format, 'post')
})

test('feed com a 2ª mídia vira carrossel; 21ª mídia é recusada e o arquivo copiado não fica para trás', async () => {
  const { dir, repo, o } = await setup()
  const { post } = await o.create({ network: 'instagram', format: 'feed', title: 'Feed que cresce', caption: 'x' })
  const src = join(dir, 'slide.png')
  await writeFile(src, PNG)
  const one = await o.attach(post.id, src, 'png')
  assert.equal(one.grew, false)
  assert.equal(one.post.format, 'feed')
  const two = await o.attach(post.id, src, 'png')
  assert.equal(two.grew, true)
  assert.equal(two.post.format, 'carrossel')
  const li = await o.create({ network: 'linkedin', format: 'post', title: 'Muitas imagens', caption: 'x' })
  const all = await Promise.all(Array.from({ length: 22 }, () => o.attach(li.post.id, src, 'png').then(() => 'ok', (e) => (e instanceof Fault ? e.code : 'erro'))))
  assert.equal(all.filter((r) => r === 'ok').length, 20)
  assert.deepEqual(all.filter((r) => r !== 'ok'), ['invalid', 'invalid'])
  const files = (await readdir(join(dir, 'posts', li.post.id))).filter((f) => f.startsWith('m-'))
  assert.equal(files.length, 20)
  assert.equal((await repo.get(li.post.id))?.media.length, 20)
})

test('excluir rascunho move a pasta com a mídia para .lixeira, some da lista e emite gone; segunda vez é not_found', async () => {
  const { dir, repo } = await setup()
  const b = bus()
  const seen: string[] = []
  b.on('gone', (e) => seen.push(e.id))
  const o = ops({ repo, config: async () => defaults(), bus: b, now })
  const { post } = await o.create({ network: 'instagram', format: 'feed', title: 'Rascunho que não vai', caption: 'x' })
  const src = join(dir, 'slide.png')
  await writeFile(src, PNG)
  const { name } = await o.attach(post.id, src, 'png')
  const fica = await o.create({ network: 'instagram', format: 'feed', title: 'Fica', caption: 'y' })

  await o.remove(post.id)
  assert.deepEqual(seen, [post.id])
  assert.equal(await lstat(join(dir, 'posts', post.id)).catch(() => null), null)
  const bin = await readdir(join(dir, '.lixeira'))
  assert.equal(bin.length, 1)
  assert.match(bin[0]!, new RegExp(`^${post.id}-\\d{8}-\\d{6}$`))
  assert.deepEqual((await readdir(join(dir, '.lixeira', bin[0]!))).sort(), [name, 'post.md'].sort())
  assert.equal(await repo.get(post.id), null)
  assert.deepEqual((await posts(dir).list()).map((p) => p.id), [fica.post.id])
  await assert.rejects(o.remove(post.id), (e) => e instanceof Fault && e.code === 'not_found')
  await assert.rejects(o.patch(post.id, { caption: 'z' }), (e) => e instanceof Fault && e.code === 'not_found')
  await assert.rejects(o.remove('../config.json'), (e) => e instanceof Fault && e.code === 'not_found')
  assert.deepEqual(seen, [post.id])
})

test('excluir espera a edição em andamento no mesmo post e não deixa nada para trás', async () => {
  const { dir, repo, o } = await setup()
  const { post } = await o.create({ network: 'instagram', format: 'feed', title: 'Corrida', caption: 'x' })
  const results = await Promise.allSettled([o.patch(post.id, { caption: 'antes' }), o.remove(post.id), o.patch(post.id, { caption: 'depois' })])
  assert.deepEqual(results.map((r) => r.status), ['fulfilled', 'fulfilled', 'rejected'])
  const [moved] = await readdir(join(dir, '.lixeira'))
  assert.match(await readFile(join(dir, '.lixeira', moved!, 'post.md'), 'utf8'), /\nantes\n$/)
  assert.deepEqual(await repo.list(), [])
})
