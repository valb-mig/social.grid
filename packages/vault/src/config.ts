import { readFile, stat } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { fail } from '@social-grid/core/fault.ts'
import { defaults, merge, schema, type Config } from '@social-grid/core/plan/config.ts'
import { save } from './atomic.ts'

export type Store = {
  file: string
  load(): Promise<Config>
  save(input: unknown): Promise<Config>
  projects(): Promise<string>
  mine(): Promise<boolean>
}

export async function root(path: string, home: string): Promise<string> {
  const r = resolve(path)
  const h = resolve(home)
  if (r === '/' || r === h || h.startsWith(r + sep)) fail('invalid', 'a pasta de projetos não pode ser a raiz, a home nem uma pasta acima dela')
  const st = await stat(r).catch(() => null)
  if (!st?.isDirectory()) fail('invalid', `pasta não encontrada: ${r}`)
  return r
}

export function config(vault: string, home: string): Store {
  const file = join(vault, 'config.json')
  let cache: { mtime: number; cfg: Config } | null = null
  let own = -1

  async function load(): Promise<Config> {
    const st = await stat(file).catch(() => null)
    if (!st) return defaults()
    if (cache?.mtime === st.mtimeMs) return cache.cfg
    let cfg: Config
    try {
      cfg = schema.parse(merge(JSON.parse(await readFile(file, 'utf8'))))
    } catch {
      cfg = defaults()
    }
    cache = { mtime: st.mtimeMs, cfg }
    return cfg
  }

  return {
    file,
    load,
    async save(input) {
      const cfg = schema.parse(merge(input))
      if (cfg.root) cfg.root = await root(cfg.root, home)
      await save(file, cfg)
      const st = await stat(file)
      own = st.mtimeMs
      cache = { mtime: st.mtimeMs, cfg }
      return cfg
    },
    async projects() {
      return (await load()).root ?? join(home, 'Projects')
    },
    async mine() {
      const st = await stat(file).catch(() => null)
      return !!st && st.mtimeMs === own
    },
  }
}
