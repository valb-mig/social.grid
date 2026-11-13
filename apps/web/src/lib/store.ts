import type { Ev, Item, Session, State, Wire } from '@social-grid/core/chat.ts'
import type { Config } from '@social-grid/core/plan/config.ts'
import type { Post, Status } from '@social-grid/core/post/post.ts'
import { create } from 'zustand'
import { api, type Row } from './api.ts'

export type Chat = { items: Item[]; seq: number; epoch: string; state: State; stream: string }

export type Act = { label: string; run: () => Promise<void> }

type S = {
  posts: Record<string, Post>
  projects: Row[]
  config: Config | null
  root: string
  vault: string
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
  move(id: string, to: Status): Promise<Post | null>
  drop(id: string): void
  forget(id: string): void
  wire(m: Wire): void
  loadProjects(): Promise<void>
  loadConfig(): Promise<void>
  setConfig(c: Config): void
  loadChat(id: string): Promise<void>
  loadSessions(): Promise<void>
  event(id: string, epoch: string, seq: number | null, ev: Ev): void
  fail(msg: string): void
  note(msg: string, act?: Act): void
  notice: string
  act: Act | null
}

let saving: ReturnType<typeof setTimeout> | undefined

const empty = (epoch: string): Chat => ({ items: [], seq: 0, epoch, state: 'closed', stream: '' })

export const useStore = create<S>((set, get) => ({
  posts: {},
  projects: [],
  config: null,
  root: '',
  vault: '~/SocialGrid',
  live: false,
  peers: [],
  loaded: false,
  fresh: {},
  chats: {},
  sessions: [],
  error: '',
  notice: '',
  act: null,

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
      get().drop(id)
    }
  },

  put(p) {
    set({ posts: { ...get().posts, [p.id]: p } })
  },

  async move(id, to) {
    try {
      const { post } = await api.move(id, to)
      get().put(post)
      return post
    } catch (e) {
      get().fail(e instanceof Error ? e.message : 'não deu para mudar o status')
      return null
    }
  },

  drop(id) {
    if (!(id in get().posts)) return
    const posts = { ...get().posts }
    delete posts[id]
    set({ posts })
  },

  forget(id) {
    const chats = { ...get().chats }
    delete chats[id]
    set({ chats, sessions: get().sessions.filter((s) => s.id !== id) })
  },

  wire(m) {
    if (m.t === 'post') void get().refresh(m.id)
    if (m.t === 'gone') get().drop(m.id)
    if (m.t === 'config') void get().loadConfig()
    if (m.t === 'chat') get().event(m.id, m.epoch, m.seq, m.ev)
    if (m.t === 'unchat') get().forget(m.id)
    if (m.t === 'peers') set({ peers: m.list })
  },

  async loadProjects() {
    set({ projects: await api.projects() })
  },

  async loadConfig() {
    const s = await api.config()
    set({ config: s.config, root: s.root, vault: s.vault || get().vault })
  },

  setConfig(c) {
    set({ config: c })
    clearTimeout(saving)
    saving = setTimeout(async () => {
      try {
        const s = await api.save(c)
        set({ root: s.root, vault: s.vault || get().vault })
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
    set({ error: msg, notice: '', act: null })
    setTimeout(() => {
      if (get().error === msg) set({ error: '' })
    }, 5000)
  },

  note(msg, act) {
    set({ notice: msg, act: act ?? null, error: '' })
    setTimeout(() => {
      if (get().notice === msg) set({ notice: '', act: null })
    }, act ? 7000 : 5000)
  },
}))

export const list = (posts: Record<string, Post>) => Object.values(posts).filter((p) => !p.archived)
