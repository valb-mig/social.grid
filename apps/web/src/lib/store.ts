import type { Ev, Item, Session, State } from '@social-grid/core/chat.ts'
import type { Config } from '@social-grid/core/plan/config.ts'
import type { Post } from '@social-grid/core/post/post.ts'
import { create } from 'zustand'
import { api, type Row } from './api.ts'

export type Chat = { items: Item[]; seq: number; epoch: string; state: State; stream: string }

type S = {
  posts: Record<string, Post>
  projects: Row[]
  config: Config | null
  root: string
  live: boolean
  peers: string[]
  loaded: boolean
  fresh: Record<string, number>
  chats: Record<string, Chat>
  sessions: Session[]
  error: string
  boot(): Promise<void>
  refresh(id: string): Promise<void>
  put(p: Post): void
  loadProjects(): Promise<void>
  loadConfig(): Promise<void>
  setConfig(c: Config): void
  loadChat(id: string): Promise<void>
  loadSessions(): Promise<void>
  event(id: string, epoch: string, seq: number | null, ev: Ev): void
  fail(msg: string): void
  note(msg: string): void
  notice: string
}

let saving: ReturnType<typeof setTimeout> | undefined

const empty = (epoch: string): Chat => ({ items: [], seq: 0, epoch, state: 'closed', stream: '' })

export const useStore = create<S>((set, get) => ({
  posts: {},
  projects: [],
  config: null,
  root: '',
  live: false,
  peers: [],
  loaded: false,
  fresh: {},
  chats: {},
  sessions: [],
  error: '',
  notice: '',

  async boot() {
    const [posts] = await Promise.all([api.posts(), get().loadConfig()])
    set({ posts: Object.fromEntries(posts.map((p) => [p.id, p])), loaded: true })
    void get().loadProjects()
  },

  async refresh(id) {
    try {
      const { post } = await api.post(id)
      get().put(post)
    } catch {
      const posts = { ...get().posts }
      delete posts[id]
      set({ posts })
    }
  },

  put(p) {
    set({ posts: { ...get().posts, [p.id]: p } })
  },

  async loadProjects() {
    set({ projects: await api.projects() })
  },

  async loadConfig() {
    const s = await api.config()
    set({ config: s.config, root: s.root })
  },

  setConfig(c) {
    set({ config: c })
    clearTimeout(saving)
    saving = setTimeout(async () => {
      try {
        const s = await api.save(c)
        set({ root: s.root })
      } catch (e) {
        get().fail(e instanceof Error ? e.message : 'não deu para salvar a config')
        void get().loadConfig()
      }
    }, 500)
  },

  async loadChat(id) {
    const cur = get().chats[id]
    const r = await api.events(id, cur?.seq ?? 0, cur?.epoch)
    const now = get().chats[id]
    const base = now && now.epoch === r.epoch ? now : empty(r.epoch)
    const items = [...base.items, ...r.events.filter((e) => e.seq > base.seq)]
    set({ chats: { ...get().chats, [id]: { ...base, items, seq: items.at(-1)?.seq ?? base.seq, state: r.state } } })
  },

  async loadSessions() {
    set({ sessions: await api.chats() })
  },

  event(id, epoch, seq, ev) {
    if (ev.k === 'post') set({ fresh: { ...get().fresh, [ev.id]: Date.now() } })
    const cur = get().chats[id]
    if (!cur) return
    if (epoch !== cur.epoch) {
      if (ev.k !== 'delta') void get().loadChat(id).catch(() => undefined)
      return
    }
    if (ev.k === 'delta') {
      set({ chats: { ...get().chats, [id]: { ...cur, stream: cur.stream + ev.text } } })
      return
    }
    if (seq === null || seq <= cur.seq) return
    if (seq > cur.seq + 1) {
      void get().loadChat(id).catch(() => undefined)
      return
    }
    const next: Chat = { ...cur, items: [...cur.items, { seq, ev }], seq }
    if (ev.k === 'text') next.stream = ''
    if (ev.k === 'state') {
      next.state = ev.state
      if (ev.state !== 'running') next.stream = ''
    }
    set({ chats: { ...get().chats, [id]: next } })
  },

  fail(msg) {
    set({ error: msg, notice: '' })
    setTimeout(() => {
      if (get().error === msg) set({ error: '' })
    }, 5000)
  },

  note(msg) {
    set({ notice: msg, error: '' })
    setTimeout(() => {
      if (get().notice === msg) set({ notice: '' })
    }, 5000)
  },
}))

export const list = (posts: Record<string, Post>) => Object.values(posts).filter((p) => !p.archived)
