import { get } from '@social-grid/core/network/index.ts'
import { hook, len, type Issue, type Pack } from '@social-grid/core/network/net.ts'
import { bundle, check } from '@social-grid/core/post/ops.ts'
import type { Post, Status } from '@social-grid/core/post/post.ts'
import { useStore } from './store.ts'

export type Read = {
  pk: Pack
  title: string | null
  head: string
  tail: string
  gap: string
  rest: string
  tags: string[]
  size: number
  max: number
  warns: Issue[]
}

export function read(post: Post): Read {
  const pk = bundle(post)
  const net = get(post.network)
  const head = hook(pk.caption, net.hook).head
  const cut = pk.caption.indexOf('\n')
  const line = cut < 0 ? pk.caption : pk.caption.slice(0, cut)
  const after = cut < 0 ? '' : pk.caption.slice(cut)
  const gap = /^\s*/.exec(after)?.[0] ?? ''
  const issues = check(post)
  return {
    pk,
    title: issues.some((i) => i.code.startsWith('title')) ? post.title : null,
    head,
    tail: line.slice(head.length),
    gap,
    rest: after.slice(gap.length),
    tags: pk.tags.split(' ').filter(Boolean),
    size: len(pk.text),
    max: net.max,
    warns: issues.filter((i) => i.level === 'warn'),
  }
}

export const DRAFTED = 'Voltou pra rascunho'

export async function draft(move: (to: Status) => Promise<boolean>, view: (s: Status) => void): Promise<boolean> {
  if (!(await move('draft'))) return false
  view('draft')
  useStore.getState().note(DRAFTED, {
    label: 'Desfazer',
    run: async () => {
      if (await move('ready')) view('ready')
    },
  })
  return true
}
