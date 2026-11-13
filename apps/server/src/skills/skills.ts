import { lstat, mkdir, readdir, readFile, realpath } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { fail } from '@social-grid/core/fault.ts'
import { NAME, type Config } from '@social-grid/core/plan/config.ts'
import { write } from '@social-grid/vault/atomic.ts'
import { read as yaml, split } from '@social-grid/vault/front.ts'

export type Kind = 'skill' | 'agent'
export type Entry = { kind: Kind; name: string; about: string; files: string[]; missing: boolean }
export type Doc = { kind: Kind; name: string; file: string; path: string; front: string; body: string }

export const MAX = 256 * 1024
const REF = /^references\/[a-z0-9][a-z0-9._-]{0,80}\.md$/
const MAIN = 'SKILL.md'
const BANG = '!`'

export function skills(home: () => string) {
  const base = (kind: Kind) => join(home(), '.claude', kind === 'skill' ? 'skills' : 'agents')

  function named(kind: Kind, name: string, cfg: Config) {
    const list = kind === 'skill' ? cfg.skills : cfg.agents
    if (!NAME.test(name) || !list.includes(name)) fail('refused', `${kind === 'skill' ? 'skill' : 'agente'} fora da lista da config: ${name}`)
  }

  function rel(kind: Kind, name: string, file: string): string[] {
    if (kind === 'agent') {
      if (file !== `${name}.md`) fail('refused', 'arquivo inválido')
      return [file]
    }
    if (file !== MAIN && (!REF.test(file) || file.includes('..'))) fail('refused', 'só SKILL.md e references/*.md')
    return [name, ...file.split('/')]
  }

  async function nolink(path: string, must: boolean) {
    const st = await lstat(path).catch(() => null)
    if (!st) {
      if (must) fail('not_found', 'não encontrado')
      return null
    }
    if (st.isSymbolicLink()) fail('refused', 'link simbólico não é aceito')
    return st
  }

  async function resolve(kind: Kind, name: string, file: string, create: boolean): Promise<string> {
    const root = base(kind)
    const real = await realpath(root).catch(() => fail('not_found', `${root} não existe`))
    const parts = rel(kind, name, file)
    let cur = root
    for (const [i, p] of parts.entries()) {
      cur = join(cur, p)
      const last = i === parts.length - 1
      const st = await nolink(cur, !create || i === 0)
      if (!st && !last) await mkdir(cur)
      if (st && !last && !st.isDirectory()) fail('refused', 'caminho inválido')
      if (st && last && !st.isFile()) fail('refused', 'não é um arquivo')
    }
    const parent = await realpath(join(cur, '..'))
    if (parent !== real && !parent.startsWith(real + sep)) fail('refused', 'caminho fora de ~/.claude')
    return cur
  }

  async function about(path: string): Promise<string> {
    const text = await readFile(path, 'utf8').catch(() => '')
    const s = split(text)
    if (!s) return ''
    try {
      const d = yaml(s.front).description
      return typeof d === 'string' ? d.replace(/\s+/g, ' ').trim().slice(0, 200) : ''
    } catch {
      return ''
    }
  }

  return {
    async list(cfg: Config): Promise<Entry[]> {
      const out: Entry[] = []
      for (const name of cfg.skills) {
        const dir = join(base('skill'), name)
        const st = await lstat(dir).catch(() => null)
        if (!st?.isDirectory()) {
          out.push({ kind: 'skill', name, about: '', files: [], missing: true })
          continue
        }
        const refs = await readdir(join(dir, 'references'), { withFileTypes: true }).catch(() => [])
        const files = [MAIN, ...refs.filter((f) => f.isFile() && REF.test(`references/${f.name}`)).map((f) => `references/${f.name}`).sort()]
        out.push({ kind: 'skill', name, about: await about(join(dir, MAIN)), files, missing: false })
      }
      for (const name of cfg.agents) {
        const path = join(base('agent'), `${name}.md`)
        const st = await lstat(path).catch(() => null)
        out.push({ kind: 'agent', name, about: st?.isFile() ? await about(path) : '', files: [`${name}.md`], missing: !st?.isFile() })
      }
      return out
    },

    async read(kind: Kind, name: string, file: string, cfg: Config): Promise<Doc> {
      named(kind, name, cfg)
      const path = await resolve(kind, name, file, false)
      const st = await lstat(path)
      if (st.size > MAX) fail('too_large', 'arquivo grande demais')
      const text = await readFile(path, 'utf8')
      const s = split(text)
      return { kind, name, file, path, front: s ? s.front : '', body: s ? s.body : text }
    },

    async write(kind: Kind, name: string, file: string, body: string, cfg: Config): Promise<Doc> {
      named(kind, name, cfg)
      if (body.length > MAX) fail('too_large', 'texto grande demais')
      if (body.includes(BANG)) fail('refused', 'o texto tem exclamação seguida de crase, que no Claude Code do terminal roda um comando ao abrir a skill; tire essa sequência para salvar')
      const path = await resolve(kind, name, file, true)
      const old = await readFile(path, 'utf8').catch(() => null)
      const s = old === null ? null : split(old)
      if (!s && /^﻿?---\s*\n/.test(body)) fail('refused', 'frontmatter não pode ser criado por aqui')
      const text = s ? `---\n${s.front}---\n${body}` : body
      await write(path, text)
      return { kind, name, file, path, front: s ? s.front : '', body }
    },
  }
}

export type Skills = ReturnType<typeof skills>
