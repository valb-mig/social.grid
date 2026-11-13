import { GERAL, type Post } from '../post/post.ts'

export const PID = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/

export type Project = {
  id: string
  name: string
  path: string
  about: string
  icon: boolean
  mono: string
  last: string | null
  week: number
  month: number
}

export type Icon = { file: string; type: string }

export type Source = {
  list(): Promise<Project[]>
  get(id: string): Promise<Project | null>
  icon(id: string): Promise<Icon | null>
}

export type Stats = { draft: number; ready: number; posted: number; total: number; quiet: boolean }

export function mono(name: string): string {
  const parts = name
    .replace(/\.[a-z]+$/i, '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
  const s = parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : (parts[0] ?? name).slice(0, 2)
  return s.toLowerCase() || '??'
}

export function stats(project: Project, posts: Post[]): Stats {
  const own = posts.filter((p) => !p.archived && p.project === project.id)
  const n = (s: Post['status']) => own.filter((p) => p.status === s).length
  return {
    draft: n('draft'),
    ready: n('ready'),
    posted: n('posted'),
    total: own.length,
    quiet: project.id !== GERAL && project.month > 0 && own.length === 0,
  }
}
