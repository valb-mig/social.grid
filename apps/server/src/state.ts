import { chmod, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { json, locks, save } from '@social-grid/vault/atomic.ts'

export type State = {
  dir: string
  read<T>(name: string, fallback: T): Promise<T>
  write(name: string, data: unknown): Promise<void>
}

export async function state(dir: string): Promise<State> {
  await mkdir(dir, { recursive: true, mode: 0o700 })
  await chmod(dir, 0o700)
  const lock = locks()
  return {
    dir,
    read: (name, fallback) => json(join(dir, name), fallback),
    write: (name, data) => lock(name, () => save(join(dir, name), data, 0o600)),
  }
}
