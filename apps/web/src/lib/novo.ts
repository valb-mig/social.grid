import type { Input } from '@social-grid/core/post/post.ts'
import { api } from './api.ts'
import { useStore } from './store.ts'

export async function novo(i: Partial<Input>, go: (to: string) => void): Promise<void> {
  try {
    const r = await api.create({ network: 'instagram', format: 'feed', title: 'Post novo', ...i })
    useStore.getState().put(r.post)
    go(`/post/${r.post.id}`)
  } catch (e) {
    useStore.getState().fail(e instanceof Error ? e.message : 'não deu para criar o post')
  }
}

export type SlotRef = { date: string; time: string; net: string; format: string }

export function ask(o: { project?: string; slot?: SlotRef; post?: string }): string {
  const q = new URLSearchParams()
  if (o.project) q.set('projeto', o.project)
  if (o.slot) {
    q.set('slot', `${o.slot.date}T${o.slot.time}`)
    q.set('rede', o.slot.net)
    q.set('formato', o.slot.format)
  }
  if (o.post) q.set('post', o.post)
  return `/chat?${q}`
}
