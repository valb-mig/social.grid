import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

export async function write(file: string, data: string | Uint8Array, mode = 0o644): Promise<void> {
  const dir = dirname(file)
  await mkdir(dir, { recursive: true })
  const tmp = join(dir, `.${basename(file)}.${randomBytes(4).toString('hex')}.tmp`)
  try {
    await writeFile(tmp, data, { mode })
    await rename(tmp, file)
  } catch (err) {
    await rm(tmp, { force: true })
    throw err
  }
}

export const save = (file: string, data: unknown, mode?: number) => write(file, `${JSON.stringify(data, null, 2)}\n`, mode)

export async function json<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

export function locks() {
  const map = new Map<string, Promise<unknown>>()
  return <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const run = (map.get(key) ?? Promise.resolve()).then(fn)
    const tail = run.catch(() => undefined)
    map.set(key, tail)
    void tail.then(() => {
      if (map.get(key) === tail) map.delete(key)
    })
    return run
  }
}

export function limit(n: number) {
  let active = 0
  const wait: (() => void)[] = []
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= n) await new Promise<void>((r) => wait.push(r))
    active++
    try {
      return await fn()
    } finally {
      active--
      wait.shift()?.()
    }
  }
}
