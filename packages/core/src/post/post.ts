import type { Day, Hm } from '../day.ts'

export const STATUSES = ['draft', 'ready', 'posted'] as const
export type Status = (typeof STATUSES)[number]

export type Post = {
  id: string
  project: string
  network: string
  format: string
  type: string
  status: Status
  date: Day | null
  time: Hm | null
  title: string
  caption: string
  hashtags: string[]
  media: string[]
  comment: string
  postedAt: string | null
  createdAt: string
  updatedAt: string
  archived: boolean
}

export type Fresh = Omit<Post, 'id'>

export const GERAL = 'geral'
export const ID = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/
export const MEDIA = /^[a-z0-9][a-z0-9_-]{0,80}\.[a-z0-9]{2,5}$/
export const MAX_MEDIA = 20
export const MAX_TAGS = 60
export const MAX_TYPE = 60

export type Input = {
  project?: string
  network: string
  format: string
  type?: string
  title: string
  caption?: string
  hashtags?: string[]
  date?: Day | null
  time?: Hm | null
  comment?: string
}

export type Changes = Partial<Pick<Post, 'project' | 'network' | 'format' | 'type' | 'title' | 'caption' | 'hashtags' | 'media' | 'date' | 'time' | 'comment' | 'archived'>>

export function slug(title: string): string {
  const s = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '')
  return s || 'post'
}

export const line = (s: string) => s.replace(/[\r\n]+/g, ' ').trim()

export function tag(s: string): string {
  return s.trim().replace(/^#+/, '').replace(/[\s#,]+/g, '')
}

export function tags(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of list) {
    const t = tag(raw)
    const k = t.toLowerCase()
    if (!t || seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

export const hashes = (list: string[]) => tags(list).map((t) => `#${t}`).join(' ')

export function make(i: Input, now: Date): Fresh {
  const at = now.toISOString()
  return {
    project: i.project || GERAL,
    network: i.network,
    format: i.format,
    type: line(i.type ?? ''),
    status: 'draft',
    date: i.date ?? null,
    time: i.time ?? null,
    title: line(i.title),
    caption: i.caption ?? '',
    hashtags: tags(i.hashtags ?? []),
    media: [],
    comment: i.comment ?? '',
    postedAt: null,
    createdAt: at,
    updatedAt: at,
    archived: false,
  }
}

export function stamp(prev: string, now: Date): string {
  const last = Date.parse(prev)
  return new Date(Number.isNaN(last) ? now.getTime() : Math.max(now.getTime(), last + 1)).toISOString()
}

export function patch(post: Post, c: Changes, now: Date): Post {
  const next: Post = { ...post, ...c, updatedAt: stamp(post.updatedAt, now) }
  if (c.title !== undefined) next.title = line(c.title)
  if (c.type !== undefined) next.type = line(c.type)
  if (c.hashtags !== undefined) next.hashtags = tags(c.hashtags)
  if (c.project !== undefined) next.project = c.project || GERAL
  return next
}
