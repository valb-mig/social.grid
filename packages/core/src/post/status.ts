import { today } from '../day.ts'
import { fail } from '../fault.ts'
import { errors, type Issue } from '../network/net.ts'
import { stamp, type Post, type Status } from './post.ts'

export type Move = { now: Date; issues: Issue[] }

const NAMES: Record<Status, string> = { draft: 'rascunho', ready: 'pronto', posted: 'postado' }

const sameDay = (iso: string, now: Date) => today(new Date(iso)) === today(now)

export function can(post: Post, to: Status, o: Move): string | null {
  const from = post.status
  if (from === to) return null
  if (to === 'ready' && errors(o.issues).length) return `não fica pronto: ${errors(o.issues).map((i) => i.text).join('; ')}`
  if (from === 'draft' && to === 'ready') return null
  if (from === 'ready' && (to === 'draft' || to === 'posted')) return null
  if (from === 'posted' && to === 'ready' && post.postedAt && sameDay(post.postedAt, o.now)) return null
  if (from === 'posted' && to === 'ready') return 'postado só volta a pronto no mesmo dia'
  return `de ${NAMES[from]} não dá para ir a ${NAMES[to]}`
}

export function move(post: Post, to: Status, o: Move): Post {
  if (post.status === to) return post
  const why = can(post, to, o)
  if (why) fail('refused', why)
  return { ...post, status: to, postedAt: to === 'posted' ? o.now.toISOString() : null, updatedAt: stamp(post.updatedAt, o.now) }
}
