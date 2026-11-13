import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { bus } from '@social-grid/core/bus.ts'
import { ops } from '@social-grid/core/post/ops.ts'
import { open } from '@social-grid/vault/open.ts'
import { find, reply, type Ctx } from '../src/tools.ts'

async function setup() {
  const base = await mkdtemp(join(tmpdir(), 'sg-mcp-'))
  const home = join(base, 'home')
  const root = join(home, 'Projects')
  await mkdir(join(root, 'mocha.app', '.git'), { recursive: true })
  const v = open(join(base, 'vault'), home)
  await v.cfg.save({ root })
  const b = bus()
  const seen: string[] = []
  b.on('post', (e) => seen.push(e.id))
  const now = () => new Date('2026-11-13T10:00:00')
  const ctx: Ctx = {
    ops: ops({ repo: v.repo, config: v.cfg.load, bus: b, now, known: async (id) => !!(await v.projects.get(id)) }),
    repo: v.repo,
    config: v.cfg.load,
    projects: v.projects,
    roots: async () => [root, v.dir],
    now,
  }
  return { base, root, v, ctx, seen }
}

const args = {
  projeto: 'mocha.app',
  rede: 'instagram',
  formato: 'feed',
  titulo: 'Briefing estilo Obsidian',
  legenda: 'Seu briefing ainda mora no WhatsApp?',
  hashtags: ['#buildinpublic', 'devbrasil'],
  data: '2026-11-18',
  hora: '12:00',
}

test('criar_post com vault temporário grava post.md e emite post no bus', async () => {
  const { v, ctx, seen } = await setup()
  const r = (await find('criar_post')!.run(ctx, args)) as { post: { id: string; status: string; hashtags: string[] }; avisos: string[] }
  const md = join(v.dir, 'posts', r.post.id, 'post.md')
  assert.ok(existsSync(md))
  assert.match(await readFile(md, 'utf8'), /Seu briefing ainda mora no WhatsApp\?\n$/)
  assert.deepEqual(seen, [r.post.id])
  assert.equal(r.post.status, 'draft')
  assert.deepEqual(r.post.hashtags, ['buildinpublic', 'devbrasil'])
  assert.ok(r.avisos.some((a) => a.startsWith('erro: Feed precisa de mídia')))
})

test('criar_post recusa projeto que não existe e formato de outra rede', async () => {
  const { ctx } = await setup()
  const bad = await reply(() => find('criar_post')!.run(ctx, { ...args, projeto: 'nao-existe' }))
  assert.equal(bad.isError, true)
  const fmt = await reply(() => find('criar_post')!.run(ctx, { ...args, formato: 'artigo' }))
  assert.equal(fmt.isError, true)
})

test('anexar_midia aceita imagem de dentro dos projetos e recusa arquivo de fora ou que não é mídia', async () => {
  const { base, root, ctx } = await setup()
  const r = (await find('criar_post')!.run(ctx, args)) as { post: { id: string } }
  const png = join(root, 'mocha.app', 'shot.png')
  await writeFile(png, Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'))
  const ok = (await find('anexar_midia')!.run(ctx, { id: r.post.id, caminho: png })) as { post: { midia: string[] } }
  assert.equal(ok.post.midia.length, 1)

  const fora = join(base, 'fora.png')
  await writeFile(fora, Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'))
  assert.equal((await reply(() => find('anexar_midia')!.run(ctx, { id: r.post.id, caminho: fora }))).isError, true)

  const svg = join(root, 'mocha.app', 'logo.png')
  await writeFile(svg, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
  assert.equal((await reply(() => find('anexar_midia')!.run(ctx, { id: r.post.id, caminho: svg }))).isError, true)

  const parecido = `${root}-x`
  await mkdir(parecido, { recursive: true })
  await writeFile(join(parecido, 'a.png'), Buffer.from('89504e470d0a1a0a', 'hex'))
  assert.equal((await reply(() => find('anexar_midia')!.run(ctx, { id: r.post.id, caminho: join(parecido, 'a.png') }))).isError, true)
})

test('editar_post muda campos e status, e listar_slots mostra só os vazios', async () => {
  const { ctx } = await setup()
  const r = (await find('criar_post')!.run(ctx, { ...args, rede: 'linkedin', formato: 'post', hashtags: ['a', 'b', 'c'] })) as { post: { id: string; atualizado_em: string } }
  const e = (await find('editar_post')!.run(ctx, { id: r.post.id, atualizado_em: r.post.atualizado_em, hora: '08:30', data: '2026-11-17', status: 'ready' })) as { post: { status: string; hora: string } }
  assert.equal(e.post.status, 'ready')
  assert.equal(e.post.hora, '08:30')
  const slots = (await find('listar_slots')!.run(ctx, { de: '2026-11-16', ate: '2026-11-17' })) as { data: string; hora: string; rede: string }[]
  assert.deepEqual(slots, [
    { data: '2026-11-16', hora: '12:00', rede: 'instagram', formato: 'feed' },
    { data: '2026-11-17', hora: '19:00', rede: 'instagram', formato: 'story' },
  ])
  assert.equal((await reply(() => find('listar_slots')!.run(ctx, { de: '0001-01-01', ate: '9999-12-31' }))).isError, true)
})

test('no chat de um projeto, o agente não mexe em post de outro projeto, não marca postado e só anexa arquivo do projeto', async () => {
  const { root, v, ctx } = await setup()
  await mkdir(join(root, 'editr', '.git'), { recursive: true })
  const outro = (await find('criar_post')!.run(ctx, { ...args, projeto: 'editr', titulo: 'Post do editr' })) as { post: { id: string; atualizado_em: string } }
  const proprio = (await find('criar_post')!.run(ctx, { ...args, titulo: 'Post do mocha' })) as { post: { id: string } }
  const chat: Ctx = { ...ctx, chat: { project: 'mocha.app', dir: join(root, 'mocha.app'), made: new Set() } }
  const run = (name: string, a: object) => reply(() => find(name)!.run(chat, a))

  const edit = await run('editar_post', { id: outro.post.id, legenda: 'texto injetado' })
  assert.equal(edit.isError, true)
  assert.match(edit.content[0]!.text, /outro projeto/)
  assert.equal((await v.repo.get(outro.post.id))?.caption, args.legenda)

  const png = join(root, 'mocha.app', 'shot.png')
  await writeFile(png, Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'))
  assert.equal((await run('anexar_midia', { id: outro.post.id, caminho: png })).isError, true)
  assert.equal((await run('anexar_midia', { id: proprio.post.id, caminho: png })).isError, undefined)

  const vizinho = join(root, 'editr', 'shot.png')
  await writeFile(vizinho, Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'))
  const fora = await run('anexar_midia', { id: proprio.post.id, caminho: vizinho })
  assert.match(fora.content[0]!.text, /pasta do projeto desta conversa/)
  assert.equal((await run('anexar_midia', { id: proprio.post.id, caminho: join(v.dir, 'config.json') })).isError, true)

  const postado = await run('editar_post', { id: proprio.post.id, status: 'posted' })
  assert.match(postado.content[0]!.text, /postado é coisa do usuário/)
  assert.equal((await run('editar_post', { id: proprio.post.id, legenda: 'ajuste do chat' })).isError, undefined)

  const geral = (await run('criar_post', { ...args, projeto: 'geral', titulo: 'Post geral criado no chat' })).content[0]!.text
  const id = (JSON.parse(geral) as { post: { id: string } }).post.id
  assert.equal((await run('editar_post', { id, hora: '18:00' })).isError, undefined)
  assert.equal((await reply(() => find('editar_post')!.run(ctx, { id: outro.post.id, legenda: 'o terminal edita qualquer post' }))).isError, undefined)
})
