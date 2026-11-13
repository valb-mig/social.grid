import { days, weekday, type Day, type Hm } from '../day.ts'
import { slot } from '../network/index.ts'
import type { Post } from '../post/post.ts'
import type { Config } from './config.ts'

export type Slot = { net: string; format: string; date: Day; time: Hm; post: string | null }

export function slots(config: Config, from: Day, to: Day, posts: Post[]): Slot[] {
  const live = posts.filter((p) => !p.archived && p.date && p.time)
  const out: Slot[] = []
  for (const date of days(from, to)) {
    const wd = weekday(date)
    for (const r of config.rules) {
      if (!r.on || !config.nets[r.net]?.on || !r.days.includes(wd)) continue
      for (const time of r.times) {
        const hit = live.find((p) => p.network === r.net && slot(p.network, p.format) === r.format && p.date === date && p.time === time)
        out.push({ net: r.net, format: r.format, date, time, post: hit?.id ?? null })
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
}

export const open = (list: Slot[]) => list.filter((s) => !s.post)
