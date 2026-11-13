export type Events = {
  post: { id: string }
  gone: { id: string }
  config: Record<string, never>
}

export type Name = keyof Events
type Fn<K extends Name> = (e: Events[K]) => void

export type Bus = {
  on<K extends Name>(name: K, fn: Fn<K>): () => void
  off<K extends Name>(name: K, fn: Fn<K>): void
  emit<K extends Name>(name: K, e: Events[K]): void
}

export function bus(): Bus {
  const map = new Map<Name, Set<Fn<never>>>()
  const off = <K extends Name>(name: K, fn: Fn<K>) => {
    map.get(name)?.delete(fn as Fn<never>)
  }
  return {
    on(name, fn) {
      const set = map.get(name) ?? new Set()
      set.add(fn as Fn<never>)
      map.set(name, set)
      return () => off(name, fn)
    },
    off,
    emit(name, e) {
      for (const fn of map.get(name) ?? []) {
        try {
          ;(fn as Fn<typeof name>)(e)
        } catch {}
      }
    },
  }
}
