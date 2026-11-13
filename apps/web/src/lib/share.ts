import { mime } from '@social-grid/core/media.ts'
import type { Post } from '@social-grid/core/post/post.ts'
import { useEffect, useState } from 'react'
import { api } from './api.ts'

const cache = new Map<string, Promise<File[]>>()

const key = (p: Post) => `${p.id}:${p.media.join(',')}`

export function files(p: Post): Promise<File[]> {
  const k = key(p)
  let hit = cache.get(k)
  if (!hit) {
    hit = Promise.all(
      p.media.map(async (name) => {
        const res = await fetch(api.media(p.id, name))
        if (!res.ok) throw new Error(`a mídia ${name} não baixou (${res.status})`)
        return new File([await res.blob()], name, { type: mime(name) })
      }),
    )
    hit.catch(() => cache.delete(k))
    cache.set(k, hit)
  }
  return hit
}

export type Media = { state: 'none' | 'loading' | 'ready' | 'error'; list: File[]; retry(): void }

export function useMedia(p: Post): Media {
  const k = key(p)
  const [got, set] = useState<{ k: string; state: Media['state']; list: File[] }>({ k: '', state: 'loading', list: [] })
  const [n, again] = useState(0)
  useEffect(() => {
    if (!p.media.length) return
    let on = true
    set({ k, state: 'loading', list: [] })
    files(p).then(
      (list) => on && set({ k, state: 'ready', list }),
      () => on && set({ k, state: 'error', list: [] }),
    )
    return () => {
      on = false
    }
  }, [k, n])
  if (!p.media.length) return { state: 'none', list: [], retry: () => undefined }
  return { state: got.k === k ? got.state : 'loading', list: got.k === k ? got.list : [], retry: () => again((x) => x + 1) }
}

function fallback(text: string): boolean {
  const t = document.createElement('textarea')
  t.value = text
  t.style.position = 'fixed'
  t.style.opacity = '0'
  document.body.append(t)
  t.select()
  const ok = document.execCommand('copy')
  t.remove()
  return ok
}

export async function copy(text: string): Promise<boolean> {
  if (!navigator.clipboard) return fallback(text)
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return fallback(text)
  }
}

export type Shared = { k: 'shared' } | { k: 'cancelled' } | { k: 'unsupported' } | { k: 'failed'; why: string }

export async function share(text: string, list: File[]): Promise<Shared> {
  const copied = navigator.clipboard ? navigator.clipboard.writeText(text).then(() => true, () => false) : Promise.resolve(fallback(text))
  const data: ShareData = list.length ? { files: list } : { text }
  if (!navigator.share || (navigator.canShare && !navigator.canShare(data))) {
    await copied
    return { k: 'unsupported' }
  }
  try {
    await navigator.share(data)
    await copied
    return { k: 'shared' }
  } catch (e) {
    await copied
    const name = e instanceof DOMException ? e.name : ''
    if (name === 'AbortError') return { k: 'cancelled' }
    if (name === 'NotAllowedError') return { k: 'failed', why: 'o navegador não deixou compartilhar agora; toque de novo no botão' }
    return { k: 'failed', why: `não deu para compartilhar: ${e instanceof Error ? e.message : 'erro desconhecido'}` }
  }
}
