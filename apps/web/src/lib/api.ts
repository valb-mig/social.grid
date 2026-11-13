import type { Log, Session } from '@social-grid/core/chat.ts'
import type { Issue, Pack } from '@social-grid/core/network/net.ts'
import type { Config } from '@social-grid/core/plan/config.ts'
import type { Slot } from '@social-grid/core/plan/slots.ts'
import type { Changes, Input, Post, Status } from '@social-grid/core/post/post.ts'
import type { Project, Stats } from '@social-grid/core/project/project.ts'

export type Full = { post: Post; issues: Issue[]; pack: Pack; grew?: boolean }
export type Row = Project & { stats: Stats }
export type Settings = { config: Config; root: string; vault: string }
export type Entry = { kind: 'skill' | 'agent'; name: string; about: string; files: string[]; missing: boolean }
export type Doc = { kind: 'skill' | 'agent'; name: string; file: string; path: string; front: string; body: string }

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
    throw new ApiError(res.status, e.message || e.error || res.statusText)
  }
  return (await res.json()) as T
}

const enc = encodeURIComponent

export const api = {
  posts: () => call<Post[]>('GET', '/api/posts'),
  post: (id: string) => call<Full>('GET', `/api/posts/${enc(id)}`),
  create: (i: Input) => call<Full>('POST', '/api/posts', i),
  patch: (id: string, c: Changes, base?: string) => call<Full>('PATCH', `/api/posts/${enc(id)}`, { ...c, ...(base ? { base } : {}) }),
  move: (id: string, to: Status) => call<Full>('POST', `/api/posts/${enc(id)}/status`, { to }),
  remove: (id: string) => call<{ ok: true }>('DELETE', `/api/posts/${enc(id)}`, {}),
  async upload(id: string, file: File): Promise<Full> {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/posts/${enc(id)}/media`, { method: 'POST', body: form })
    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as { message?: string }
      throw new ApiError(res.status, e.message || 'falha no envio')
    }
    return (await res.json()) as Full
  },
  media: (id: string, name: string) => `/api/posts/${enc(id)}/media/${enc(name)}`,
  projects: () => call<Row[]>('GET', '/api/projects'),
  icon: (id: string) => `/api/projects/${enc(id)}/icon`,
  config: () => call<Settings>('GET', '/api/config'),
  save: (c: Config) => call<Settings>('PUT', '/api/config', c),
  slots: (de: string, ate: string) => call<Slot[]>('GET', `/api/slots?de=${de}&ate=${ate}`),
  skills: () => call<Entry[]>('GET', '/api/skills'),
  skill: (kind: string, name: string, file: string) => call<Doc>('GET', `/api/skills/${kind}/${enc(name)}?file=${enc(file)}`),
  write: (kind: string, name: string, file: string, body: string) => call<Doc>('PUT', `/api/skills/${kind}/${enc(name)}`, { file, body }),
  push: () => call<{ key: string; count: number }>('GET', '/api/push'),
  subscribe: (sub: PushSubscriptionJSON) => call<{ count: number }>('POST', '/api/push/subscribe', { sub }),
  unsubscribe: (endpoint: string) => call<{ count: number }>('POST', '/api/push/unsubscribe', { endpoint }),
  test: () => call<{ ok: true }>('POST', '/api/push/test', {}),
  chats: () => call<Session[]>('GET', '/api/chat'),
  unchat: (id: string) => call<{ ok: true }>('DELETE', `/api/chat/${enc(id)}`, {}),
  chat: (project: string, text: string, images: string[] = []) => call<Session>('POST', '/api/chat', { project, text, ...(images.length ? { images } : {}) }),
  events: (id: string, after = 0, epoch?: string) => call<Log>('GET', `/api/chat/${enc(id)}?after=${after}${epoch ? `&epoch=${enc(epoch)}` : ''}`),
  send: (id: string, text: string, images: string[] = []) => call<{ ok: true }>('POST', `/api/chat/${enc(id)}/send`, { text, ...(images.length ? { images } : {}) }),
  async picture(file: File): Promise<string> {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/chat/images', { method: 'POST', body: form })
    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as { message?: string }
      throw new ApiError(res.status, e.message || 'falha no envio da imagem')
    }
    return ((await res.json()) as { name: string }).name
  },
  image: (name: string) => `/api/chat/images/${enc(name)}`,
  stop: (id: string) => call<{ ok: true }>('POST', `/api/chat/${enc(id)}/stop`, {}),
}
