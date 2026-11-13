import { watch as fsWatch, type FSWatcher } from 'node:fs'
import { lstat, mkdir } from 'node:fs/promises'
import { join, sep } from 'node:path'
import type { Bus } from '@social-grid/core/bus.ts'
import { ID } from '@social-grid/core/post/post.ts'

export type Mine = { post(id: string): Promise<boolean>; config(): Promise<boolean> }

export async function watch(vault: string, bus: Bus, mine: Mine, wait = 200): Promise<() => void> {
  const posts = join(vault, 'posts')
  await mkdir(posts, { recursive: true })
  const timers = new Map<string, NodeJS.Timeout>()
  const later = (key: string, fn: () => Promise<void>) => {
    clearTimeout(timers.get(key))
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key)
        void fn().catch(() => undefined)
      }, wait),
    )
  }

  const watchers: FSWatcher[] = [
    fsWatch(posts, { recursive: true }, (_e, file) => {
      if (!file || file.endsWith('.tmp')) return
      const id = String(file).split(sep)[0] ?? ''
      if (!ID.test(id)) return
      later(`post:${id}`, async () => {
        if (await mine.post(id)) return
        const st = await lstat(join(posts, id, 'post.md')).catch(() => null)
        if (st?.isFile()) bus.emit('post', { id })
        else bus.emit('gone', { id })
      })
    }),
    fsWatch(vault, (_e, file) => {
      if (file !== 'config.json') return
      later('config', async () => {
        if (!(await mine.config())) bus.emit('config', {})
      })
    }),
  ]
  for (const w of watchers) w.on('error', () => undefined)

  return () => {
    for (const w of watchers) w.close()
    for (const t of timers.values()) clearTimeout(t)
  }
}
