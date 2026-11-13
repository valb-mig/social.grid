export type State = 'running' | 'idle' | 'closed'

export type Ev =
  | { k: 'user'; text: string; images?: string[] }
  | { k: 'text'; text: string }
  | { k: 'delta'; text: string }
  | { k: 'tool'; id: string; name: string; info: string }
  | { k: 'done'; id: string; ok: boolean }
  | { k: 'post'; id: string }
  | { k: 'state'; state: State }
  | { k: 'error'; text: string }

export type Item = { seq: number; ev: Ev }

export type Log = { state: State; epoch: string; events: Item[] }

export type Meta = {
  id: string
  sdk: string | null
  project: string
  title: string
  createdAt: string
  updatedAt: string
}

export type Session = Meta & { state: State }

export type Wire =
  | { t: 'post'; id: string }
  | { t: 'gone'; id: string }
  | { t: 'config' }
  | { t: 'chat'; id: string; epoch: string; seq: number | null; ev: Ev }
  | { t: 'peers'; list: string[] }
  | { t: 'pong' }

export const PAST = 'past'
