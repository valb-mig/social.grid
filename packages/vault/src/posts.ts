import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile, lstat, mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { clock, fmt, isDay, isHm } from '@social-grid/core/day.ts'
import { fail } from '@social-grid/core/fault.ts'
import { find, nets, rules } from '@social-grid/core/network/index.ts'
import { GERAL, ID, MEDIA, STATUSES, slug, type Fresh, type Post } from '@social-grid/core/post/post.ts'
import type { Repo } from '@social-grid/core/post/repo.ts'
import { z } from 'zod'
import { locks, write } from './atomic.ts'
import { dump, read, split } from './front.ts'

const any = z.unknown().optional()
const text = (fallback = '') => any.transform((v) => (typeof v === 'string' ? v : fallback))
const maybe = (ok: (v: unknown) => boolean) => any.transform((v) => (ok(v) ? (v as string) : null))
const list = any.transform((v) => (Array.isArray(v) ? (v as unknown[]) : []))

const schema = z.object({
  project: text(GERAL),
  network: text(),
  format: text(),
  type: text(),
  status: z.enum(STATUSES).catch('draft'),
  date: maybe(isDay),
  time: maybe(isHm),
  title: text(),
  hashtags: list.transform((l) => l.flatMap((t) => (typeof t === 'string' || typeof t === 'number' ? [String(t)] : []))),
  media: list.transform((l) => l.filter((m): m is string => typeof m === 'string' && MEDIA.test(m))),
  comment: text(),
  postedAt: maybe((v) => typeof v === 'string'),
  createdAt: text(),
  updatedAt: text(),
  archived: z.boolean().catch(false),
})

function fit(network: string, format: string): [string, string] {
  const net = find(network) ?? nets[0]!
  return [net.id, net.formats.some((f) => f.id === format) ? format : rules(net.id)[0]!.id]
}

export function decode(id: string, raw: string, mtime: Date): Post | null {
  const s = split(raw)
  if (!s) return null
  const r = schema.safeParse(read(s.front))
  if (!r.success) return null
  const at = mtime.toISOString()
  const [network, format] = fit(r.data.network, r.data.format)
  return {
    id,
    ...r.data,
    project: r.data.project || GERAL,
    network,
    format,
    title: r.data.title.replace(/[\r\n]+/g, ' ').trim() || id,
    caption: s.body.replace(/^\n/, '').replace(/\n$/, ''),
    createdAt: r.data.createdAt || at,
    updatedAt: r.data.updatedAt || at,
  }
}

export function encode(p: Post): string {
  const front = {
    id: p.id,
    project: p.project,
    network: p.network,
    format: p.format,
    ...(p.type ? { type: p.type } : {}),
    status: p.status,
    date: p.date,
    time: p.time,
    title: p.title,
    hashtags: p.hashtags,
    media: p.media,
    comment: p.comment,
    postedAt: p.postedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    ...(p.archived ? { archived: true } : {}),
  }
  return `---\n${dump(front)}---\n\n${p.caption}\n`
}

const rand = (n: number) =>
  [...randomBytes(n)].map((b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')

export type Posts = Repo & { dir: string; bin: string; mine(id: string): Promise<boolean> }

export const BIN = '.lixeira'
const GONE = -1

const stamp = (d: Date) => `${fmt(d).replace(/-/g, '')}-${clock(d).replace(':', '')}${String(d.getSeconds()).padStart(2, '0')}`

export function posts(vault: string): Posts {
  const dir = join(vault, 'posts')
  const bin = join(vault, BIN)
  const lock = locks()
  const cache = new Map<string, { mtime: number; post: Post }>()
  const own = new Map<string, number>()

  const folder = (id: string) => {
    if (!ID.test(id)) fail('not_found', `post não encontrado: ${id}`)
    return join(dir, id)
  }
  const md = (id: string) => join(folder(id), 'post.md')

  async function load(id: string, fresh = false): Promise<Post | null> {
    const st = await lstat(md(id)).catch(() => null)
    if (!st?.isFile()) return null
    const hit = cache.get(id)
    if (!fresh && hit && hit.mtime === st.mtimeMs) return hit.post
    const post = decode(id, await readFile(md(id), 'utf8'), st.mtime)
    if (post) cache.set(id, { mtime: st.mtimeMs, post })
    return post
  }

  async function put(post: Post): Promise<void> {
    await write(md(post.id), encode(post))
    const st = await stat(md(post.id))
    own.set(post.id, st.mtimeMs)
    cache.set(post.id, { mtime: st.mtimeMs, post })
  }

  async function exists(id: string) {
    const st = await lstat(folder(id)).catch(() => null)
    if (!st?.isDirectory()) fail('not_found', `post não encontrado: ${id}`)
    return folder(id)
  }

  return {
    dir,
    bin,

    async list() {
      const names = await readdir(dir).catch(() => [] as string[])
      const all = await Promise.all(names.filter((n) => ID.test(n)).map((n) => load(n).catch(() => null)))
      return all
        .filter((p): p is Post => p !== null)
        .sort((a, b) => (a.date ?? '9').localeCompare(b.date ?? '9') || (a.time ?? '').localeCompare(b.time ?? '') || a.createdAt.localeCompare(b.createdAt))
    },

    async get(id) {
      return ID.test(id) ? load(id) : null
    },

    async create(fresh: Fresh) {
      await mkdir(dir, { recursive: true })
      for (let i = 0; i < 6; i++) {
        const id = `${slug(fresh.title)}-${rand(4)}`
        try {
          await mkdir(folder(id))
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'EEXIST') continue
          throw err
        }
        const post = { ...fresh, id }
        await put(post)
        return post
      }
      return fail('conflict', 'não deu para gerar um id livre')
    },

    update(id, fn, base) {
      return lock(id, async () => {
        const cur = await load(id, true)
        if (!cur) fail('not_found', `post não encontrado: ${id}`)
        if (base && cur.updatedAt !== base) fail('conflict', 'o post mudou em outro lugar; recarregue antes de salvar')
        const next = fn(cur)
        if (next === cur) return cur
        const post = { ...next, id }
        await put(post)
        return post
      })
    },

    async attach(id, src, ext, move = false) {
      if (!/^[a-z0-9]{2,5}$/.test(ext)) fail('invalid', 'extensão inválida')
      const f = await exists(id)
      const name = `m-${randomBytes(5).toString('hex')}.${ext}`
      const target = join(f, name)
      if (move) {
        await rename(src, target)
        return name
      }
      const tmp = join(f, `.${name}.tmp`)
      try {
        await copyFile(src, tmp, constants.COPYFILE_EXCL)
        await rename(tmp, target)
      } catch (err) {
        await rm(tmp, { force: true })
        throw err
      }
      return name
    },

    async drop(id, name) {
      if (!MEDIA.test(name)) return
      await rm(join(folder(id), name), { force: true })
    },

    remove(id) {
      return lock(id, async () => {
        const from = folder(id)
        const st = await lstat(from).catch(() => null)
        if (!st?.isDirectory()) fail('not_found', `post não encontrado: ${id}`)
        await mkdir(bin, { recursive: true })
        const at = stamp(new Date())
        for (let i = 0; i < 6; i++) {
          const to = join(bin, i ? `${id}-${at}-${rand(4)}` : `${id}-${at}`)
          if (await lstat(to).catch(() => null)) continue
          own.set(id, GONE)
          cache.delete(id)
          try {
            await rename(from, to)
          } catch (err) {
            own.delete(id)
            throw err
          }
          return
        }
        fail('conflict', 'não deu para mover o post para a lixeira')
      })
    },

    async temp(id) {
      return join(await exists(id), `.up-${randomBytes(6).toString('hex')}.tmp`)
    },

    async file(id, name) {
      if (!ID.test(id) || !MEDIA.test(name)) return null
      const p = join(folder(id), name)
      const st = await lstat(p).catch(() => null)
      return st?.isFile() ? p : null
    },

    async mine(id) {
      if (!ID.test(id)) return false
      const st = await stat(md(id)).catch(() => null)
      return own.get(id) === (st ? st.mtimeMs : GONE)
    },
  }
}
