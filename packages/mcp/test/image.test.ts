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

function decode(buf: Buffer) {
  const w = buf.readUInt32BE(16)
  const h = buf.readUInt32BE(20)
  const ch = buf[25] === 6 ? 4 : 3
  const parts: Buffer[] = []
  for (let i = 8; i < buf.length; ) {
    const len = buf.readUInt32BE(i)
    if (buf.toString('ascii', i + 4, i + 8) === 'IDAT') parts.push(buf.subarray(i + 8, i + 8 + len))
    i += 12 + len
  }
  const raw = inflateSync(Buffer.concat(parts))
  const row = w * ch
  const px = Buffer.alloc(h * row)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (row + 1)]!
    for (let x = 0; x < row; x++) {
      const a = x >= ch ? px[y * row + x - ch]! : 0
      const b = y ? px[(y - 1) * row + x]! : 0
      const c = x >= ch && y ? px[(y - 1) * row + x - ch]! : 0
      const p = a + b - c
      const near = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c
      const v = raw[y * (row + 1) + 1 + x]!
      px[y * row + x] = v + [0, a, b, (a + b) >> 1, near][f]!
    }
  }
  return (x: number, y: number) => px.subarray((y * w + x) * ch, (y * w + x) * ch + 3).toString('hex')
}

async function look(v: Awaited<ReturnType<typeof setup>>['v'], id: string, i = 0) {
  const post = (await v.repo.get(id))!
  return decode(await readFile(join(v.dir, 'posts', id, post.media[i]!)))
}

const dark = (hex: string) => [0, 2, 4].every((i) => parseInt(hex.slice(i, i + 2), 16) < 40)

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

test('gerar_imagem faz a capa do vídeo do YouTube em paisagem, as fotos do TikTok em vertical e a comunidade em quadrado', { skip }, async () => {
  const { v, run, make } = await setup()
  const cases: [object, number, number][] = [
    [{ rede: 'youtube', formato: 'video', titulo: 'Vídeo do mocha' }, 1920, 1080],
    [{ rede: 'tiktok', formato: 'fotos', titulo: 'Fotos do mocha' }, 1080, 1920],
    [{ rede: 'youtube', formato: 'comunidade', titulo: 'Aviso do mocha' }, 1080, 1080],
  ]
  for (const [a, w, h] of cases) {
    const id = await make(a)
    const r = await run('gerar_imagem', { id, html: art(w, h) })
    assert.equal(r.isError, undefined, r.content[0]!.text)
    assert.equal((JSON.parse(r.content[0]!.text) as { tamanho: string }).tamanho, `${w}x${h}`)
    assert.deepEqual(await media(v, id), [{ w, h, corner: 'ff00ff' }])
  }
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

test('gerar_imagem recusa reels, vídeo do TikTok e Shorts, post de outro projeto no chat e HTML gigante, sem abrir o Chrome', async () => {
  const { v, ctx, run, make } = await setup()
  for (const a of [{ formato: 'reels' }, { rede: 'tiktok', formato: 'video' }, { rede: 'youtube', formato: 'shorts' }]) {
    const id = await make({ ...a, titulo: `Vídeo do mocha ${a.formato}` })
    assert.match((await run('gerar_imagem', { id, html: art(1080, 1920) })).content[0]!.text, /precisa de vídeo/)
    assert.deepEqual((await v.repo.get(id))!.media, [])
  }

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

test('capturar_tela tira o print de uma página do PC depois dos dados carregarem, no layout da escala', { skip }, async () => {
  const { v, chat, run, make } = await setup()
  const hits: string[] = []
  const srv = createServer((req, res) => {
    hits.push(req.url ?? '')
    if (req.url === '/dados') return void setTimeout(() => res.end('#ffff00'), 300)
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(
      `<!doctype html><style>body{margin:0;height:100vh;background:#ff00ff}@media (max-width:600px){body{background:#00ffff}}</style><body><script>if (location.search === '?dados') fetch('/dados').then((r) => r.text()).then((c) => (document.body.style.background = c))</script></body>`,
    )
  })
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok))
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`
  const app: Ctx = { ...chat, app: url }
  try {
    const largo = await make()
    const r = await run('capturar_tela', { id: largo, url: `${url}/` }, app)
    assert.equal(r.isError, undefined, r.content[0]!.text)
    assert.match(r.content[0]!.text, /em 1080x1350/)
    assert.deepEqual(await media(v, largo), [{ w: 1080, h: 1350, corner: 'ff00ff' }])

    const celular = await make({ titulo: 'Print no celular' })
    const c = await run('capturar_tela', { id: celular, url: '/', escala: 2 }, app)
    assert.match(c.content[0]!.text, /em 540x675/)
    assert.deepEqual(await media(v, celular), [{ w: 1080, h: 1350, corner: '00ffff' }])

    const dados = await make({ titulo: 'Print com dados' })
    assert.equal((await run('capturar_tela', { id: dados, url: `${url}/?dados`, tamanho: 'quadrado' }, app)).isError, undefined)
    assert.deepEqual(await media(v, dados), [{ w: 1080, h: 1080, corner: 'ffff00' }])
    assert.ok(hits.includes('/dados'))
  } finally {
    srv.close()
  }
})

test('capturar_tela com o app parado diz que a página não abriu, em vez de anexar a tela de erro do Chrome', { skip }, async () => {
  const { v, run, make } = await setup()
  const srv = createServer()
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok))
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/`
  await new Promise((ok) => srv.close(ok))
  const id = await make()
  const r = await run('capturar_tela', { id, url })
  assert.equal(r.isError, true)
  assert.match(r.content[0]!.text, /a página não abriu \(net::ERR_CONNECTION_REFUSED\); o app está rodando\?/)
  assert.deepEqual((await v.repo.get(id))!.media, [])
})

test('capturar_tela só abre página deste PC e recusa o resto antes de abrir o Chrome', async () => {
  const { v, ctx, run, make } = await setup()
  const id = await make()
  const urls = [
    'file:///etc/passwd',
    'http://example.com/',
    'http://192.168.0.1/',
    'http://0.0.0.0:7338/',
    'http://user:senha@localhost:7338/',
    'http://localhost.evil.com/',
    '//localhost:7338/',
    'javascript:alert(1)',
    'data:text/html,oi',
    'ftp://localhost/',
  ]
  for (const url of urls) assert.equal((await run('capturar_tela', { id, url })).isError, true, url)
  assert.match((await run('capturar_tela', { id, url: '/hoje' })).content[0]!.text, /endereço do social\.grid/)
  const outro = await make({ projeto: 'editr', titulo: 'Post do editr' }, ctx)
  assert.match((await run('capturar_tela', { id: outro, url: 'http://localhost:7338/' })).content[0]!.text, /outro projeto/)
  assert.deepEqual((await v.repo.get(id))!.media, [])
  assert.deepEqual((await v.repo.get(outro))!.media, [])
})

const stage = (inner: string) =>
  `<!doctype html><html><head><style>body{width:1080px;height:1350px;margin:0;background:#ff00ff;position:relative}</style></head><body>${inner}</body></html>`

const phone = (attrs: string, inner = '') => `<sg-mockup modelo="celular" largura="443" ${attrs} style="position:absolute;left:40px;top:40px">${inner}</sg-mockup>`
const laptop = (attrs: string, inner = '') => `<sg-mockup modelo="laptop" largura="470" ${attrs} style="position:absolute;left:560px;top:40px">${inner}</sg-mockup>`

test('sg-mockup põe o aparelho sem fundo e o HTML da tela dentro do recorte, com a ilha por cima', { skip }, async () => {
  const { v, run, make } = await setup()
  const id = await make()
  const fill = (c: string) => `<div style="position:absolute;inset:0;background:${c}"></div>`
  const r = await run('gerar_imagem', { id, html: stage(phone('cor="prata"', fill('#00ff00')) + laptop('', fill('#0000ff'))) })
  assert.equal(r.isError, undefined, r.content[0]!.text)
  assert.deepEqual(JSON.parse(r.content[0]!.text).mockups, ['celular prata 443x894', 'laptop preto 470x272'])
  const at = await look(v, id)
  assert.equal(at(5, 5), 'ff00ff')
  assert.equal(at(261, 600), '00ff00')
  assert.equal(at(65 + 391, 600), '00ff00')
  assert.ok(dark(at(40 + 18, 600)), 'borda do celular')
  assert.ok(dark(at(65 + 12, 61 + 12)), 'canto arredondado da tela fica na borda')
  assert.equal(at(261, 40 + 50), '000000')
  assert.equal(at(40 + 2, 40 + 2), 'ff00ff')
  assert.equal(at(795, 170), '0000ff')
  assert.ok(dark(at(560 + 50, 170)), 'borda do laptop')
  assert.equal(at(560 + 2, 40 + 2), 'ff00ff')
  assert.equal(at(1060, 600), 'ff00ff')
})

test('sg-mockup com print abre a página no tamanho da tela de cada aparelho, desde o carregamento', { skip }, async () => {
  const { v, chat, run, make } = await setup()
  const hits: string[] = []
  const srv = createServer((req, res) => {
    hits.push(req.url ?? '')
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><style>html,body{margin:0;height:100%}</style><body><script>document.body.style.background = innerWidth < 500 ? '#00ffff' : '#ffff00'</script></body>`)
  })
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok))
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`
  const app: Ctx = { ...chat, app: url }
  try {
    const id = await make()
    const r = await run('gerar_imagem', { id, html: stage(phone('print="/"') + laptop(`print="${url}/painel"`)) }, app)
    assert.equal(r.isError, undefined, r.content[0]!.text)
    const at = await look(v, id)
    assert.equal(at(261, 600), '00ffff')
    assert.equal(at(795, 170), 'ffff00')
    assert.deepEqual(hits.filter((h) => h !== '/favicon.ico').sort(), ['/', '/painel'])
  } finally {
    srv.close()
  }
})

test('sg-mockup com midia põe uma imagem do post na tela e o HTML filho por cima dela', { skip }, async () => {
  const { v, run, make } = await setup()
  const id = await make()
  assert.equal((await run('gerar_imagem', { id, html: stage('').replace('#ff00ff', '#ff0000') })).isError, undefined)
  const name = (await v.repo.get(id))!.media[0]!
  const band = '<div style="position:absolute;left:0;top:300px;width:393px;height:100px;background:#0000ff"></div>'
  const r = await run('gerar_imagem', { id, html: stage(phone(`midia="${name}"`, band)) })
  assert.equal(r.isError, undefined, r.content[0]!.text)
  const at = await look(v, id, 1)
  assert.equal(at(261, 700), 'ff0000')
  assert.equal(at(261, 40 + 21 + 350), '0000ff')
  assert.equal(at(5, 5), 'ff00ff')
})

test('sg-mockup errado, print de fora do PC e mídia que o post não tem são recusados antes de abrir o Chrome', async () => {
  const { v, run, make } = await setup()
  const id = await make()
  const before = process.env.SOCIAL_GRID_CHROME
  process.env.SOCIAL_GRID_CHROME = '/nao/existe/chrome'
  try {
    const cases: [string, RegExp][] = [
      [phone('print="http://example.com/"'), /só abre página deste PC/],
      [phone('print="file:///etc/passwd"'), /só abre página http deste PC/],
      [phone('print="/hoje"'), /endereço do social\.grid/],
      [phone('midia="m-0000000000.png"'), /não tem a mídia m-0000000000\.png/],
      [phone('midia="../../segredo.png"'), /não tem a mídia/],
      ['<sg-mockup modelo="tablet"></sg-mockup>', /desconhecido: tablet/],
      [phone('cor="dourado"'), /cores preto, prata, roxo/],
    ]
    for (const [html, msg] of cases) {
      const r = await run('gerar_imagem', { id, html: stage(html) })
      assert.equal(r.isError, true, html)
      assert.match(r.content[0]!.text, msg, html)
    }
    assert.deepEqual((await v.repo.get(id))!.media, [])
  } finally {
    if (before === undefined) delete process.env.SOCIAL_GRID_CHROME
    else process.env.SOCIAL_GRID_CHROME = before
  }
})

test('capturar_tela abre a página já na largura da escala, mesmo abaixo de 500 px, e o script lê essa largura', { skip }, async () => {
  const { v, chat, run, make } = await setup()
  const srv = createServer((_req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><style>html,body{margin:0;height:100%}</style><body><script>document.body.style.background = innerWidth === 360 ? '#00ff00' : '#ff0000'</script></body>`)
  })
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok))
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`
  try {
    const id = await make()
    const r = await run('capturar_tela', { id, url: `${url}/`, escala: 3 }, { ...chat, app: url })
    assert.match(r.content[0]!.text, /em 360x450/)
    assert.deepEqual(await media(v, id), [{ w: 1080, h: 1350, corner: '00ff00' }])
  } finally {
    srv.close()
  }
})

test('sg-mockup navegador: página até a borda da janela, cantos de baixo recortados, barra no tema e endereço escrito na pílula', { skip }, async () => {
  const { v, run, make } = await setup()
  const id = await make({ formato: 'carrossel', titulo: 'Site do mocha' })
  const fill = '<div style="position:absolute;inset:0;background:#00ff00"></div>'
  const win = (x: number, attrs: string) => `<sg-mockup modelo="navegador" largura="720" ${attrs} style="position:absolute;left:${x}px;top:40px">${fill}</sg-mockup>`
  const html = `<!doctype html><html><body style="width:1920px;height:1080px;margin:0;background:#ff00ff;position:relative">${win(40, 'endereco="mocha.app"')}${win(1000, 'cor="escuro"')}</body></html>`
  const r = await run('gerar_imagem', { id, html, tamanho: 'paisagem' })
  assert.equal(r.isError, undefined, r.content[0]!.text)
  assert.deepEqual(JSON.parse(r.content[0]!.text).mockups, ['navegador claro 720x476', 'navegador escuro 720x476'])
  const at = await look(v, id)
  assert.equal(at(20, 20), 'ff00ff')
  assert.equal(at(400, 291), '00ff00')
  assert.equal(at(42, 300), '00ff00')
  assert.equal(at(400, 513), '00ff00')
  assert.equal(at(40, 515), 'ff00ff')
  assert.equal(at(758, 515), 'ff00ff')
  assert.equal(at(165, 53), 'f3f3f5')
  assert.equal(at(1125, 53), '2c2c2e')
  const ink = (x0: number, pill: string) => {
    let n = 0
    for (let x = x0 + 230; x <= x0 + 482; x++) for (let y = 47; y <= 59; y++) if (at(x, y) !== pill) n++
    return n
  }
  assert.ok(ink(40, 'e3e3e6') > 20, 'endereço na pílula clara')
  assert.equal(ink(1000, '3a3a3c'), 0, 'pílula vazia sem endereco')
})
