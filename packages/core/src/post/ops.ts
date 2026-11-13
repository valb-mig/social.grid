import type { Bus } from '../bus.ts'
import { isDay, isHm } from '../day.ts'
import { fail } from '../fault.ts'
import { format, get, grow } from '../network/index.ts'
import { errors, type Issue, type Pack } from '../network/net.ts'
import type { Config } from '../plan/config.ts'
import { PID } from '../project/project.ts'
import { GERAL, MAX_MEDIA, MAX_TAGS, MAX_TYPE, make, patch, tags, type Changes, type Input, type Post, type Status } from './post.ts'
import type { Repo } from './repo.ts'
import { move } from './status.ts'

export type Deps = {
  repo: Repo
  config: () => Promise<Config>
  bus: Bus
  now: () => Date
  known?: (project: string) => Promise<boolean>
}

export type Result = { post: Post; issues: Issue[] }

export const MAX_CAPTION = 10_000

function valid(p: Post): Post {
  format(p.network, p.format)
  if (p.date !== null && !isDay(p.date)) fail('invalid', `data inválida: ${p.date}`)
  if (p.time !== null && !isHm(p.time)) fail('invalid', `hora inválida: ${p.time}`)
  if (p.project !== GERAL && !PID.test(p.project)) fail('invalid', `projeto inválido: ${p.project}`)
  if (!p.title) fail('invalid', 'título vazio')
  if (p.title.length > 200) fail('invalid', 'título longo demais')
  if (p.type.length > MAX_TYPE) fail('invalid', 'tipo longo demais')
  if (p.caption.length > MAX_CAPTION || p.comment.length > MAX_CAPTION) fail('too_large', 'texto longo demais')
  if (p.hashtags.length > MAX_TAGS) fail('invalid', `no máximo ${MAX_TAGS} hashtags`)
  if (p.media.length > MAX_MEDIA) fail('invalid', `no máximo ${MAX_MEDIA} mídias`)
  return p
}

export const check = (post: Post): Issue[] => get(post.network).check(post)
export const bundle = (post: Post): Pack => get(post.network).pack(post)

function settle(post: Post): Post {
  if (post.status === 'ready' && errors(check(post)).length) return { ...post, status: 'draft' }
  return post
}

export function ops(d: Deps) {
  const done = (post: Post): Result => {
    d.bus.emit('post', { id: post.id })
    return { post, issues: check(post) }
  }
  const project = async (id: string) => {
    if (id !== GERAL && d.known && !(await d.known(id))) fail('invalid', `projeto não encontrado: ${id}`)
  }

  return {
    async create(i: Input): Promise<Result> {
      const cfg = await d.config()
      const fresh = make(i, d.now())
      await project(fresh.project)
      fresh.hashtags = tags([...fresh.hashtags, ...(cfg.tags.nets[fresh.network] ?? []), ...(cfg.tags.projects[fresh.project] ?? [])])
      valid({ ...fresh, id: 'x' })
      return done(await d.repo.create(fresh))
    },

    async patch(id: string, c: Changes, base?: string): Promise<Result> {
      if (c.project !== undefined) await project(c.project || GERAL)
      const post = await d.repo.update(
        id,
        (p) => {
          if (c.media && c.media.some((m) => !p.media.includes(m))) fail('invalid', 'mídia desconhecida no post')
          if (c.media && new Set(c.media).size !== c.media.length) fail('invalid', 'mídia repetida')
          return settle(valid(patch(p, c, d.now())))
        },
        base,
      )
      return done(post)
    },

    async move(id: string, to: Status, base?: string): Promise<Result> {
      const post = await d.repo.update(id, (p) => move(p, to, { now: d.now(), issues: check(p) }), base)
      return done(post)
    },

    async attach(id: string, src: string, ext: string, mv = false): Promise<Result & { name: string; grew: boolean }> {
      const full = () => fail('invalid', `no máximo ${MAX_MEDIA} mídias`)
      const cur = await d.repo.get(id)
      if (!cur) fail('not_found', `post não encontrado: ${id}`)
      if (cur.media.length >= MAX_MEDIA) full()
      const name = await d.repo.attach(id, src, ext, mv)
      let grew = false
      try {
        const post = await d.repo.update(id, (p) => {
          if (p.media.length >= MAX_MEDIA) full()
          const media = [...p.media, name]
          const fmt = grow(p.network, p.format, media.length)
          grew = fmt !== p.format
          return settle(patch(p, { media, format: fmt }, d.now()))
        })
        return { ...done(post), name, grew }
      } catch (err) {
        await d.repo.drop(id, name).catch(() => undefined)
        throw err
      }
    },

    async remove(id: string): Promise<void> {
      await d.repo.remove(id)
      d.bus.emit('gone', { id })
    },

    async get(id: string): Promise<Result> {
      const post = await d.repo.get(id)
      if (!post) fail('not_found', `post não encontrado: ${id}`)
      return { post, issues: check(post) }
    },
  }
}

export type Ops = ReturnType<typeof ops>
