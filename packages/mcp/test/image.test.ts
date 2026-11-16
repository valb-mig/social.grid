import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { test } from 'node:test'
import { inflateSync } from 'node:zlib'
import { bus } from '@social-grid/core/bus.ts'
import { ops } from '@social-grid/core/post/ops.ts'
import { open } from '@social-grid/vault/open.ts'
import { CSP, page } from '../src/render.ts'
import { find, reply, type Ctx } from '../src/tools.ts'

const browser = (process.env.PATH ?? '')
  .split(delimiter)
  .some((d) => ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].some((b) => existsSync(join(d, b))))
const skip = browser ? false : 'sem Chrome nem Chromium neste PC'

async function setup() {
  const base = await mkdtemp(join(tmpdir(), 'sg-arte-test-'))
  const home = join(base, 'home')
  const root = join(home, 'Projects')
  await mkdir(join(root, 'mocha.app', '.git'), { recursive: true })
  await mkdir(join(root, 'editr', '.git'), { recursive: true })
  const v = open(join(base, 'vault'), home)
  await v.cfg.save({ root })
  const now = () => new Date('2026-11-13T10:00:00')
  const ctx: Ctx = {
    ops: ops({ repo: v.repo, config: v.cfg.load, bus: bus(), now, known: async (id) => !!(await v.projects.get(id)) }),
    repo: v.repo,
    config: v.cfg.load,
    projects: v.projects,
    roots: async () => [root, v.dir],
    now,
  }
  const chat: Ctx = { ...ctx, chat: { project: 'mocha.app', dir: join(root, 'mocha.app'), made: new Set() } }
  const run = (name: string, a: object, c = chat) => reply(() => find(name)!.run(c, a))
  const make = async (a: object = {}, c = chat) => {
    const r = await run('criar_post', { projeto: 'mocha.app', rede: 'instagram', formato: 'feed', titulo: 'Lançamento do mocha', legenda: 'Saiu o mocha.', hashtags: [], ...a }, c)
    return (JSON.parse(r.content[0]!.text) as { post: { id: string } }).post.id
  }
  return { base, root, v, ctx, chat, run, make }
}

function png(buf: Buffer) {
  assert.equal(buf.toString('ascii', 1, 4), 'PNG')
  const parts: Buffer[] = []
  for (let i = 8; i < buf.length; ) {
    const len = buf.readUInt32BE(i)
    if (buf.toString('ascii', i + 4, i + 8) === 'IDAT') parts.push(buf.subarray(i + 8, i + 8 + len))
    i += 12 + len
  }
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), corner: inflateSync(Buffer.concat(parts)).subarray(1, 4).toString('hex') }
}

async function media(v: Awaited<ReturnType<typeof setup>>['v'], id: string) {
  const post = (await v.repo.get(id))!
  return Promise.all(post.media.map(async (m) => png(await readFile(join(v.dir, 'posts', id, m)))))
}

const art = (w: number, h: number) =>
  `<!doctype html><html lang="pt-BR"><head><style>body{width:${w}px;height:${h}px;background:#ff00ff;font-family:Manrope;color:#fff}h1{font-size:96px;font-weight:800}</style></head><body><h1>Saiu o mocha</h1></body></html>`

test('page põe charset e CSP antes do HTML e tira toda meta, inclusive o refresh', () => {
  const out = page('<!DOCTYPE html><html><head><META HTTP-EQUIV=REFRESH CONTENT="0;url=file:///etc/passwd"><meta/http-equiv=refresh content=0;url=http://x><meta charset="latin1"></head><body>oi</body></html>', '')
  assert.match(out, /^<!DOCTYPE html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy"/)
  assert.ok(out.includes(CSP))
  assert.doesNotMatch(out, /refresh|latin1/i)
  assert.match(page('<div>sem doctype</div>', ''), /^<!doctype html><meta charset="utf-8">/)
})

test('gerar_imagem desenha o HTML no tamanho do formato e anexa o PNG ao post', { skip }, async () => {
  const { v, run, make } = await setup()
  const feed = await make()
  const r = await run('gerar_imagem', { id: feed, html: art(1080, 1350) })
  assert.equal(r.isError, undefined, r.content[0]!.text)
  const body = JSON.parse(r.content[0]!.text) as { tamanho: string; arquivo: string; post: { midia: string[]; formato: string } }
  assert.equal(body.tamanho, '1080x1350')
  assert.deepEqual(body.post.midia, [body.arquivo])
  assert.match(body.arquivo, /\.png$/)
  assert.deepEqual(await media(v, feed), [{ w: 1080, h: 1350, corner: 'ff00ff' }])

  const story = await make({ formato: 'story', titulo: 'Story do mocha' })
  assert.equal((await run('gerar_imagem', { id: story, html: art(1080, 1920) })).isError, undefined)
  assert.deepEqual(await media(v, story), [{ w: 1080, h: 1920, corner: 'ff00ff' }])

  const quadrado = await make({ titulo: 'Quadrado do mocha' })
  assert.equal((await run('gerar_imagem', { id: quadrado, html: art(1080, 1080), tamanho: 'quadrado' })).isError, undefined)
  assert.deepEqual(await media(v, quadrado), [{ w: 1080, h: 1080, corner: 'ff00ff' }])
})

test('a arte roda fechada: sem script, sem rede, sem arquivo do PC e sem meta refresh', { skip }, async () => {
  const { base, v, run, make } = await setup()
  const hits: string[] = []
  const srv = createServer((req, res) => {
    hits.push(req.url ?? '')
    res.end('body{background:#00ff00}')
  })
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok))
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`
  const secret = join(base, 'segredo.html')
  await writeFile(secret, '<body style="background:#00ff00">TOKEN=abc123</body>')
  try {
    const id = await make()
    const html = `<!doctype html><html><head>
<meta http-equiv="refresh" content="0;url=file://${secret}">
<META HTTP-EQUIV=REFRESH CONTENT="0;URL=${url}/meta">
<link rel="stylesheet" href="${url}/css">
<style>@import url("${url}/import"); body{width:1080px;height:1350px;margin:0;background:#ff00ff url("file://${secret}")}</style>
<script>document.documentElement.style.background = document.body.style.background = '#00ff00'; fetch('${url}/js')</script>
</head><body>
<div style="position:absolute;right:0;bottom:0">
<img src="${url}/img"><img src="file://${secret}"><iframe src="file://${secret}"></iframe><iframe src="${url}/frame"></iframe><object data="file://${secret}"></object>
</div></body></html>`
    const r = await run('gerar_imagem', { id, html })
    assert.equal(r.isError, undefined, r.content[0]!.text)
    assert.deepEqual(await media(v, id), [{ w: 1080, h: 1350, corner: 'ff00ff' }])
    assert.deepEqual(hits, [])
  } finally {
    srv.close()
  }
})

test('gerar_imagem recusa reels, post de outro projeto no chat e HTML gigante, sem abrir o Chrome', async () => {
  const { v, ctx, run, make } = await setup()
  const reels = await make({ formato: 'reels', titulo: 'Reels do mocha' })
  assert.match((await run('gerar_imagem', { id: reels, html: art(1080, 1920) })).content[0]!.text, /precisa de vídeo/)

  const outro = await make({ projeto: 'editr', titulo: 'Post do editr' }, ctx)
  const r = await run('gerar_imagem', { id: outro, html: art(1080, 1350) })
  assert.match(r.content[0]!.text, /outro projeto/)
  assert.deepEqual((await v.repo.get(outro))!.media, [])

  const feed = await make()
  assert.equal((await run('gerar_imagem', { id: feed, html: 'x'.repeat(300_001) }, ctx)).isError, true)
  assert.equal((await run('gerar_imagem', { id: feed, html: art(1080, 1350), tamanho: '4k' }, ctx)).isError, true)
  assert.deepEqual((await v.repo.get(feed))!.media, [])
})

test('sem o Chrome no PC, gerar_imagem diz o que falta e não mexe no post', async () => {
  const { v, run, make } = await setup()
  const id = await make()
  const before = process.env.SOCIAL_GRID_CHROME
  process.env.SOCIAL_GRID_CHROME = '/nao/existe/chrome'
  try {
    const r = await run('gerar_imagem', { id, html: art(1080, 1350) })
    assert.equal(r.isError, true)
    assert.match(r.content[0]!.text, /Chrome não está em \/nao\/existe\/chrome/)
    assert.deepEqual((await v.repo.get(id))!.media, [])
  } finally {
    if (before === undefined) delete process.env.SOCIAL_GRID_CHROME
    else process.env.SOCIAL_GRID_CHROME = before
  }
})
