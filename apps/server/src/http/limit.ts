import { fail } from '@social-grid/core/fault.ts'

export function limiter(max: number, ms: number) {
  const hits = new Map<string, number[]>()
  return (key = '*'): void => {
    const now = Date.now()
    const list = (hits.get(key) ?? []).filter((t) => now - t < ms)
    if (list.length >= max) fail('busy', 'muitas requisições seguidas; espere um pouco')
    list.push(now)
    hits.set(key, list)
  }
}
