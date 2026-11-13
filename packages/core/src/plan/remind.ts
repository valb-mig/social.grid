import { at, mins, today } from '../day.ts'
import { find } from '../network/index.ts'
import type { Post } from '../post/post.ts'
import type { Config } from './config.ts'

export type Notice = { key: string; title: string; body: string; url: string }

const TITLE = 'social.grid'

export function due(posts: Post[], config: Config, now: Date, sent: ReadonlySet<string>): Notice[] {
  const out: Notice[] = []
  const { ready, before, draft } = config.push
  for (const p of posts) {
    if (p.archived || !p.date) continue
    const net = find(p.network)?.name ?? p.network
    const url = `/post/${p.id}`
    const when = p.time ? at(p.date, p.time) : null
    if (ready && p.status === 'ready' && when) {
      const left = mins(now, when)
      const key = `ready:${p.id}:${p.date}T${p.time}`
      if (left > 0 && left <= before && !sent.has(key)) out.push({ key, title: TITLE, body: `Em ${left} min: ${p.title} no ${net}. Tudo pronto pra colar.`, url })
    }
    if (draft && p.status === 'draft') {
      const start = at(p.date, config.push.at).getTime()
      const from = when ? Math.min(start, when.getTime() - before * 6e4) : start
      const live = when ? now < when : today(now) === p.date
      const key = `draft:${p.id}:${p.date}`
      if (live && now.getTime() >= from && !sent.has(key)) {
        out.push({ key, title: TITLE, body: `${p.title} (${net}${p.time ? ` às ${p.time}` : ''}) ainda é rascunho.`, url })
      }
    }
  }
  return out
}
