import { add, today } from '@social-grid/core/day.ts'
import type { Config } from '@social-grid/core/plan/config.ts'
import { due } from '@social-grid/core/plan/remind.ts'
import type { Post } from '@social-grid/core/post/post.ts'
import type { State } from '../state.ts'
import type { Sender } from './push.ts'

const FILE = 'sent.json'
const KEEP = 3

export type Deps = { posts: () => Promise<Post[]>; config: () => Promise<Config>; send: Sender; state: State }

export function remind(d: Deps) {
  return async (now: Date): Promise<number> => {
    const sent = await d.state.read<Record<string, string>>(FILE, {})
    const notices = due(await d.posts(), await d.config(), now, new Set(Object.keys(sent)))
    const oldest = add(today(now), -KEEP)
    const kept = Object.fromEntries(Object.entries(sent).filter(([, day]) => day >= oldest))
    for (const n of notices) kept[n.key] = today(now)
    if (notices.length || Object.keys(kept).length !== Object.keys(sent).length) await d.state.write(FILE, kept)
    await Promise.allSettled(notices.map((n) => d.send(n)))
    return notices.length
  }
}
