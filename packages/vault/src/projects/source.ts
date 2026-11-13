import { lstat, open, readdir, realpath, stat } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { GERAL } from '@social-grid/core/post/post.ts'
import { mono, PID, type Icon, type Project, type Source } from '@social-grid/core/project/project.ts'
import { limit } from '../atomic.ts'
import { activity } from './git.ts'

const ICONS = [
  'app-icon.svg',
  'web/public/icon.svg',
  'public/favicon.svg',
  'web/public/pwa-192.png',
  'public/icon.png',
  'src-tauri/icons/icon.png',
  'build/icon.png',
  'resources/icon.png',
]
const READMES = ['README.md', 'readme.md', 'Readme.md']
const TTL = 5 * 60_000
const MAX_ICON = 1024 * 1024
const MAX_REPOS = 300

async function head(file: string, n = 8192): Promise<string> {
  const st = await lstat(file).catch(() => null)
  if (!st?.isFile()) return ''
  const fh = await open(file, 'r')
  try {
    const buf = Buffer.alloc(n)
    const { bytesRead } = await fh.read(buf, 0, n, 0)
    return buf.subarray(0, bytesRead).toString('utf8')
  } finally {
    await fh.close()
  }
}

const plain = (s: string) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export function readme(text: string): { name: string; about: string } {
  const lines = text.split('\n')
  const at = lines.findIndex((l) => /^#\s+\S/.test(l))
  const name = at >= 0 ? plain(lines[at]!.replace(/^#\s+/, '')) : ''
  const para: string[] = []
  for (const l of lines.slice(at + 1)) {
    const t = l.trim()
    if (!t) {
      if (para.length) break
      continue
    }
    if (/^(#|!\[|<|\[!\[|```|---|\||>)/.test(t)) {
      if (para.length) break
      continue
    }
    para.push(t)
  }
  return { name: name.slice(0, 80), about: plain(para.join(' ')).slice(0, 320) }
}

export async function icon(dir: string): Promise<Icon | null> {
  const base = await realpath(dir).catch(() => null)
  if (!base) return null
  const apps = await readdir(join(dir, 'apps'), { withFileTypes: true }).catch(() => [])
  const list = [...ICONS, ...apps.filter((a) => a.isDirectory()).slice(0, 20).map((a) => `apps/${a.name}/app-icon.svg`)]
  for (const c of list) {
    const r = await realpath(join(dir, c)).catch(() => null)
    if (!r || !r.startsWith(base + sep)) continue
    const st = await stat(r).catch(() => null)
    if (!st?.isFile() || st.size > MAX_ICON) continue
    return { file: r, type: c.endsWith('.svg') ? 'image/svg+xml' : 'image/png' }
  }
  return null
}

async function stamp(dir: string): Promise<string> {
  const files = ['.git/logs/HEAD', '.git/HEAD', 'README.md']
  const st = await Promise.all(files.map((f) => stat(join(dir, f)).catch(() => null)))
  return st.map((s) => s?.mtimeMs ?? 0).join(':')
}

export function source(o: { root: () => Promise<string>; vault: string }): Source {
  const cache = new Map<string, { key: string; at: number; p: Project }>()
  const run = limit(6)

  const geral = (): Project => ({
    id: GERAL,
    name: 'geral',
    path: o.vault,
    about: 'Posts que não são de um projeto só.',
    icon: false,
    mono: 'g',
    last: null,
    week: 0,
    month: 0,
  })

  async function one(root: string, name: string): Promise<Project | null> {
    if (!PID.test(name) || name === GERAL) return null
    const dir = join(root, name)
    const st = await lstat(dir).catch(() => null)
    if (!st?.isDirectory()) return null
    if (!(await lstat(join(dir, '.git')).catch(() => null))) return null
    const key = await stamp(dir)
    const hit = cache.get(dir)
    if (hit && hit.key === key && Date.now() - hit.at < TTL) return hit.p
    const [text, ic, git] = await Promise.all([
      (async () => {
        for (const f of READMES) {
          const t = await head(join(dir, f)).catch(() => '')
          if (t) return t
        }
        return ''
      })(),
      icon(dir),
      run(() => activity(dir)),
    ])
    const rd = readme(text)
    const p: Project = { id: name, name: rd.name || name, path: dir, about: rd.about, icon: !!ic, mono: mono(rd.name || name), ...git }
    cache.set(dir, { key, at: Date.now(), p })
    return p
  }

  async function list(): Promise<Project[]> {
    const root = await o.root()
    const names = (await readdir(root).catch(() => [] as string[])).filter((n) => !n.startsWith('.')).sort().slice(0, MAX_REPOS)
    const all = await Promise.all(names.map((n) => one(root, n).catch(() => null)))
    const found = all.filter((p): p is Project => p !== null).sort((a, b) => (b.last ?? '').localeCompare(a.last ?? ''))
    return [...found, geral()]
  }

  async function get(id: string): Promise<Project | null> {
    if (id === GERAL) return geral()
    if (!PID.test(id)) return null
    return one(await o.root(), id).catch(() => null)
  }

  return {
    list,
    get,
    async icon(id) {
      const p = await get(id)
      if (!p || p.id === GERAL) return null
      return icon(p.path)
    },
  }
}
