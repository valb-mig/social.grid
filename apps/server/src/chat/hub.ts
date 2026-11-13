import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { getSessionMessages } from '@anthropic-ai/claude-agent-sdk'
import { PAST, type Ev, type Item, type Log, type Meta, type Session } from '@social-grid/core/chat.ts'
import { fail } from '@social-grid/core/fault.ts'
import type { Config } from '@social-grid/core/plan/config.ts'
import type { Post } from '@social-grid/core/post/post.ts'
import type { Project, Source } from '@social-grid/core/project/project.ts'
import type { Ctx } from '@social-grid/mcp/tools.ts'
import type { State } from '../state.ts'
import { history } from './events.ts'
import { MAX_PICS, type Pics } from './pics.ts'
import { prompt } from './prompt.ts'
import { live, scope, type Live, type Opts } from './session.ts'

const FILE = 'chat.json'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const MAX_LIVE = 2
const MAX_KEEP = 100
const IDLE = 20 * 60_000
const NEW = 'Conversa nova'
export const MAX_TEXT = 8000

export type Deps = {
  state: State
  projects: Source
  ctx: Ctx
  vault: string
  home: string
  config: () => Promise<Config>
  posts: () => Promise<Post[]>
  now: () => Date
  on: (id: string, epoch: string, seq: number | null, ev: Ev) => void
  pics: Pics
  live?: (o: Opts) => Live
  past?: (sdk: string, dir: string) => Promise<Item[]>
}

const title = (text?: string) => (text?.trim() ? text.replace(/\s+/g, ' ').trim().slice(0, 60) : NEW)

export function hub(d: Deps) {
  const lives = new Map<string, Live>()
  const spawn = d.live ?? live
  const read = d.past ?? (async (sdk: string, dir: string) => history(await getSessionMessages(sdk, { dir }).catch(() => [])))
  let metas: Meta[] | null = null

  async function all(): Promise<Meta[]> {
    if (!metas) {
      const raw = await d.state.read<Meta[]>(FILE, [])
      metas = (Array.isArray(raw) ? raw : []).filter((m) => UUID.test(m.id) && (m.sdk === null || UUID.test(m.sdk)))
    }
    return metas
  }

  async function touch(id: string, fn: (m: Meta) => Meta): Promise<void> {
    await all()
    const list = metas!
    const cur = list.find((m) => m.id === id)
    if (!cur) return
    metas = [fn({ ...cur }), ...list.filter((m) => m.id !== id)]
    await d.state.write(FILE, metas)
  }

  async function add(m: Meta): Promise<void> {
    await all()
    metas = [m, ...metas!.filter((x) => x.id !== m.id)].slice(0, MAX_KEEP)
    await d.state.write(FILE, metas)
  }

  async function find(id: string): Promise<Meta> {
    if (!UUID.test(id)) fail('not_found', 'conversa não encontrada')
    return (await all()).find((m) => m.id === id) ?? fail('not_found', 'conversa não encontrada')
  }

  const past = async (m: Meta, cwd: string): Promise<Item[]> => (m.sdk ? read(m.sdk, cwd) : [])

  function room() {
    if (lives.size < MAX_LIVE) return
    const idle = [...lives.values()].filter((l) => l.state() !== 'running').sort((a, b) => a.idle() - b.idle())
    if (!idle.length) fail('busy', `já tem ${MAX_LIVE} conversas rodando; espere uma terminar ou pare uma`)
    idle[0]!.close()
  }

  const made = (hist: Item[]) => new Set(hist.flatMap((i) => (i.ev.k === 'post' ? [i.ev.id] : [])))

  async function open(m: Meta): Promise<Live> {
    room()
    const project: Project = (await d.projects.get(m.project)) ?? fail('not_found', `projeto não encontrado: ${m.project}`)
    const [cfg, posts, hist] = await Promise.all([d.config(), d.posts(), past(m, project.path)])
    const claude = join(d.home, '.claude')
    let l: Live | null = null
    l = spawn({
      cwd: project.path,
      model: cfg.model ?? undefined,
      resume: m.sdk ?? undefined,
      append: prompt({ project, config: cfg, posts, now: d.now() }),
      scope: scope([project.path, d.vault, join(claude, 'skills'), join(claude, 'agents')]),
      ctx: { ...d.ctx, chat: { project: project.id, dir: project.path, made: made(hist) } },
      history: hist,
      emit: (epoch, seq, ev) => d.on(m.id, epoch, seq, ev),
      sdk: (sid) => {
        if (m.sdk === sid || !UUID.test(sid)) return
        m.sdk = sid
        void touch(m.id, (x) => ({ ...x, sdk: sid }))
      },
      exit: () => {
        if (lives.get(m.id) === l) lives.delete(m.id)
      },
    })
    lives.set(m.id, l)
    return l
  }

  async function load(names: string[] = []) {
    if (names.length > MAX_PICS) fail('invalid', `no máximo ${MAX_PICS} imagens por mensagem`)
    return Promise.all(names.map((n) => d.pics.load(n)))
  }

  const reaper = setInterval(() => {
    const cut = Date.now() - IDLE
    for (const l of lives.values()) if (l.idle() < cut) l.close()
  }, 60_000)
  reaper.unref()

  return {
    async list(): Promise<Session[]> {
      return (await all()).map((m) => ({ ...m, state: lives.get(m.id)?.state() ?? 'closed' }))
    },

    async start(project: string, text?: string, images?: string[]): Promise<Session> {
      if (!(await d.projects.get(project))) fail('not_found', `projeto não encontrado: ${project}`)
      if (text && text.length > MAX_TEXT) fail('too_large', 'mensagem longa demais')
      const pics = await load(images)
      const at = d.now().toISOString()
      const m: Meta = { id: randomUUID(), sdk: null, project, title: title(text), createdAt: at, updatedAt: at }
      const l = await open(m)
      await add(m)
      if (text?.trim() || pics.length) l.send(text ?? '', pics)
      return { ...m, state: l.state() }
    },

    async send(id: string, text: string, images?: string[]): Promise<void> {
      if (text.length > MAX_TEXT) fail('too_large', 'mensagem longa demais')
      const pics = await load(images)
      if (!text.trim() && !pics.length) fail('invalid', 'mensagem vazia')
      const m = await find(id)
      const l = lives.get(id) ?? (await open(m))
      l.send(text, pics)
      await touch(id, (x) => ({ ...x, title: x.title === NEW ? title(text) : x.title, updatedAt: d.now().toISOString() }))
    },

    async stop(id: string): Promise<void> {
      await find(id)
      await lives.get(id)?.stop()
    },

    async events(id: string, after: number, epoch = ''): Promise<Log> {
      const m = await find(id)
      const l = lives.get(id)
      if (l) return { state: l.state(), epoch: l.epoch, events: l.events(epoch === l.epoch ? after : 0) }
      const project = await d.projects.get(m.project)
      const hist = project ? await past(m, project.path) : []
      return { state: 'closed', epoch: PAST, events: epoch === PAST ? hist.filter((i) => i.seq > after) : hist }
    },

    shutdown() {
      clearInterval(reaper)
      for (const l of lives.values()) l.kill()
    },
  }
}

export type Hub = ReturnType<typeof hub>
