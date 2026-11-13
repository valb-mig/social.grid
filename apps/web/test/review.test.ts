import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { bus } from '@social-grid/core/bus.ts'
import { Fault, fail, type Code } from '@social-grid/core/fault.ts'
import { len } from '@social-grid/core/network/net.ts'
import { bundle, ops } from '@social-grid/core/post/ops.ts'
import { make, type Post, type Status } from '@social-grid/core/post/post.ts'
import type { Repo } from '@social-grid/core/post/repo.ts'
import { draft, DRAFTED, read } from '../src/lib/review.ts'
import { useStore } from '../src/lib/store.ts'

mock.timers.enable({ apis: ['setTimeout'] })

const db = new Map<string, Post>()
const repo = {
  async get(id: string) {
    return db.get(id) ?? null
  },
  async update(id: string, fn: (p: Post) => Post) {
    const cur = db.get(id) ?? fail('not_found', `post não encontrado: ${id}`)
    const next = fn(cur)
    db.set(id, next)
    return next
  },
} as unknown as Repo
const server = ops({ repo, config: () => Promise.reject(new Error('sem config')), bus: bus(), now: () => new Date('2026-11-13T11:50:00') })
const CODES: Record<Code, number> = { invalid: 400, not_found: 404, conflict: 409, refused: 422, too_large: 413, busy: 429 }

globalThis.fetch = (async (url: string, init?: RequestInit) => {
  const [, id = '', tail] = /^\/api\/posts\/([^/]+)(\/status)?$/.exec(url) ?? []
  try {
    const r = tail ? await server.move(decodeURIComponent(id), (JSON.parse(String(init?.body)) as { to: Status }).to) : await server.get(decodeURIComponent(id))
    return new Response(JSON.stringify({ ...r, pack: bundle(r.post) }), { status: 200 })
  } catch (e) {
    if (!(e instanceof Fault)) throw e
    return new Response(JSON.stringify({ error: e.code, message: e.message }), { status: CODES[e.code] })
  }
}) as typeof fetch

const MOCHA = `Seu design ainda mora em print solto no WhatsApp? 🫠

Eu vivia isso: referência num lugar, paleta noutro, e a tela final num Figma que ninguém abria de novo.

Aí fiz o mocha. Cada ideia vira uma pasta: briefing em markdown e o blend, versionado v1, v2, v3.

Arrasta pro lado pra ver o fluxo inteiro 👉 Você guarda suas referências onde?
`

const TAGS = ['#buildinpublic', 'devbrasil', 'DevBrasil', 'webdesign', '##designsystem', 'claudecode', 'mcp', 'typescript', 'indiedev', 'opensource']

function seed(i: Partial<Post> = {}): Post {
  const base = make({ project: 'mocha.app', network: 'instagram', format: 'carrossel', title: 'Carrossel do mocha', caption: MOCHA, hashtags: TAGS, date: '2026-11-13', time: '12:00' }, new Date('2026-11-12T10:00:00'))
  const p: Post = { ...base, id: 'carrossel-do-mocha-a1b2', status: 'ready', media: ['m-0a1b2c3d4e.jpg', 'm-1a1b2c3d4e.jpg', 'm-2a1b2c3d4e.mp4'], ...i }
  db.set(p.id, p)
  useStore.getState().put(p)
  return p
}

const toMove = (id: string) => async (to: Status) => !!(await useStore.getState().move(id, to))

test('revisão do carrossel mostra exatamente o que os botões copiam: gancho marcado, corpo, hashtags em chips', () => {
  const p = seed()
  const r = read(p)
  assert.deepEqual(r.pk, bundle(p))
  assert.equal(r.head + r.tail + r.gap + r.rest, r.pk.caption)
  assert.equal(r.pk.caption, MOCHA.trim())
  assert.equal(r.head, 'Seu design ainda mora em print solto no WhatsApp? 🫠')
  assert.equal(r.tail, '')
  assert.equal(r.gap, '\n\n')
  assert.ok(r.rest.startsWith('Eu vivia isso') && r.rest.endsWith('Você guarda suas referências onde?'))
  assert.deepEqual(r.tags, ['#buildinpublic', '#devbrasil', '#webdesign', '#designsystem', '#claudecode', '#mcp', '#typescript', '#indiedev', '#opensource'])
  assert.equal(r.tags.join(' '), r.pk.tags)
  assert.equal(r.pk.text, `${r.pk.caption}\n\n${r.pk.tags}`)
  assert.equal(r.size, len(r.pk.text))
  assert.equal(r.max, 2200)
  assert.deepEqual(r.warns, [])
})

test('LinkedIn com primeira linha longa e link no corpo: gancho corta em 210 letras, comentário sai igual ao copiado e os avisos aparecem', () => {
  const first = `Passei três anos ${'guardando print de design em pasta solta, '.repeat(5)}até fazer o mocha.`
  const caption = `  ${first}\nO código está em https://github.com/valb-mig/mocha.app  `
  const p = seed({ id: 'blend-html-puro-c3d4', network: 'linkedin', format: 'post', caption, hashtags: ['webdesign', 'html', 'ia', 'buildinpublic'], comment: '  https://github.com/valb-mig/mocha.app\n', media: [] })
  const r = read(p)
  assert.equal(r.head + r.tail + r.gap + r.rest, bundle(p).caption)
  assert.equal([...r.head].length, 210)
  assert.ok(first.startsWith(r.head) && r.tail.length > 0)
  assert.equal(r.gap, '\n')
  assert.equal(r.rest, 'O código está em https://github.com/valb-mig/mocha.app')
  assert.equal(r.pk.comment, 'https://github.com/valb-mig/mocha.app')
  assert.equal(r.max, 3000)
  assert.deepEqual(r.warns.map((i) => i.code), ['hook', 'link'])
})

test('pronto volta pra rascunho, a tela vai pro editor e o Desfazer do toast devolve a pronto', async () => {
  const p = seed()
  const views: Status[] = []
  assert.equal(await draft(toMove(p.id), (s) => views.push(s)), true)
  assert.equal(db.get(p.id)!.status, 'draft')
  assert.equal(useStore.getState().posts[p.id]!.status, 'draft')
  assert.deepEqual(views, ['draft'])
  const s = useStore.getState()
  assert.equal(s.notice, DRAFTED)
  assert.equal(s.act?.label, 'Desfazer')

  await s.act!.run()
  assert.equal(db.get(p.id)!.status, 'ready')
  assert.equal(useStore.getState().posts[p.id]!.status, 'ready')
  assert.deepEqual(views, ['draft', 'ready'])

  mock.timers.tick(7000)
  assert.equal(useStore.getState().notice, '')
  assert.equal(useStore.getState().act, null)
})

test('Desfazer não força pronto quando o post ficou inválido depois de voltar pra rascunho; postado não volta pra rascunho', async () => {
  const p = seed()
  const views: Status[] = []
  await draft(toMove(p.id), (s) => views.push(s))
  db.set(p.id, { ...db.get(p.id)!, caption: '' })
  await useStore.getState().act!.run()
  assert.equal(db.get(p.id)!.status, 'draft')
  assert.match(useStore.getState().error, /^não fica pronto: Legenda vazia/)
  assert.equal(useStore.getState().act, null)
  assert.deepEqual(views, ['draft'])

  const posted = seed({ id: 'ja-postado-e5f6', status: 'posted', postedAt: '2026-11-13T12:02:00.000Z' })
  const none: Status[] = []
  assert.equal(await draft(toMove(posted.id), (s) => none.push(s)), false)
  assert.equal(db.get(posted.id)!.status, 'posted')
  assert.match(useStore.getState().error, /de postado não dá para ir a rascunho/)
  assert.deepEqual(none, [])
  mock.timers.tick(7000)
})
