import { GERAL, type Post } from '@social-grid/core/post/post.ts'
import { Check } from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'
import type { Row } from '../lib/api.ts'
import { home } from '../lib/fmt.ts'
import { useStore } from '../lib/store.ts'
import { Find, Opt, Pop, useNav } from './pop.tsx'
import { ProjectIcon } from './project.tsx'

const RECENT = 5
const MONTH = 30 * 864e5

const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

type Item = { id: string; name: string; sub: string; seen: number }

function rank(projects: Row[], posts: Record<string, Post>, now = Date.now()) {
  const touched = new Map<string, number>()
  for (const p of Object.values(posts)) touched.set(p.project, Math.max(touched.get(p.project) ?? 0, Date.parse(p.updatedAt) || 0))
  return projects
    .filter((p) => p.id !== GERAL)
    .map((p) => ({
      p,
      seen: Math.max(p.last ? Date.parse(p.last) || 0 : 0, touched.get(p.id) ?? 0),
    }))
    .map(({ p, seen }) => ({ p, seen: seen > now - MONTH ? seen : 0 }))
}

type Props = {
  value: string
  set: (id: string) => void
  children: ReactElement
  geral?: boolean
  skip?: string[]
  title?: string
}

export function Pick({ value, set, children, geral = false, skip = [], title = 'Projeto' }: Props) {
  const projects = useStore((s) => s.projects)
  const posts = useStore((s) => s.posts)
  const root = useStore((s) => s.root)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const { groups, flat } = useMemo(() => {
    const all: Item[] = rank(projects, posts)
      .filter(({ p }) => !skip.includes(p.id))
      .map(({ p, seen }) => ({
        id: p.id,
        name: p.name,
        sub: home(p.path, root),
        seen,
      }))
    const top: Item[] = geral && !skip.includes(GERAL) ? [{ id: GERAL, name: 'geral', sub: 'sem projeto', seen: 0 }] : []
    const term = plain(q.trim())
    if (term) {
      const hit = (i: Item) => {
        const n = plain(i.name)
        const d = plain(i.id)
        if (n.startsWith(term) || d.startsWith(term)) return 2
        if (n.includes(term) || d.includes(term) || plain(i.sub).includes(term)) return 1
        return 0
      }
      const found = [...top, ...all]
        .map((i) => ({ i, s: hit(i) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || b.i.seen - a.i.seen || a.i.name.localeCompare(b.i.name, 'pt-BR'))
        .map((x) => x.i)
      return { groups: [['', found]] as [string, Item[]][], flat: found }
    }
    const recent = all
      .filter((i) => i.seen)
      .sort((a, b) => b.seen - a.seen)
      .slice(0, RECENT)
    const rest = all.filter((i) => !recent.includes(i)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    const groups: [string, Item[]][] = [
      ['', top],
      ['Recentes', recent],
      [recent.length ? 'Todos' : '', rest],
    ]
    const shown = groups.filter(([, l]) => l.length)
    return { groups: shown, flat: shown.flatMap(([, l]) => l) }
  }, [projects, posts, root, q, geral, skip])

  const close = () => setOpen(false)
  const choose = (i: number) => {
    const item = flat[i]
    if (!item) return
    close()
    if (item.id !== value) set(item.id)
  }
  const nav = useNav(flat.length, choose, close)

  const toggle = (o: boolean) => {
    setOpen(o)
    if (o) setQ('')
  }

  let n = 0
  return (
    <Pop
      open={open}
      set={toggle}
      title={title}
      trigger={children}
      width={340}
      keys={nav.keys}
      start={(el, mobile) => {
        if (!mobile) el.querySelector('input')?.focus()
        nav.jump(
          Math.max(
            0,
            flat.findIndex((i) => i.id === value),
          ),
        )
      }}
    >
      <Find
        value={q}
        set={(v) => {
          setQ(v)
          nav.setAt(0)
        }}
        label="Buscar projeto"
        placeholder="Buscar projeto"
        list={nav.list}
        active={nav.current}
      />
      <div id={nav.list} role="listbox" aria-label={title} className="opts">
        {groups.map(([name, items]) => (
          <div key={name || 'x'} role="group" aria-label={name || undefined}>
            {name && (
              <div className="grp" aria-hidden>
                <h3>{name}</h3>
              </div>
            )}
            {items.map((item) => {
              const i = n++
              return (
                <Opt key={item.id} id={nav.id(i)} at={i === nav.at} on={item.id === value} pick={() => choose(i)} hover={() => nav.setAt(i)}>
                  <ProjectIcon id={item.id} size={30} radius={9} className="!shadow-none" />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px] font-bold">{item.name}</b>
                    <small className="block truncate font-mono text-[11px] text-text-faint">{item.sub}</small>
                  </span>
                  {item.id === value && <Check size={16} strokeWidth={2.4} className="flex-none text-text" />}
                </Opt>
              )
            })}
          </div>
        ))}
        {!flat.length && <p className="px-3 py-4 text-[13px] font-semibold text-text-faint">{q.trim() ? `Nenhum projeto com "${q.trim()}".` : 'Nenhum projeto para escolher.'}</p>}
      </div>
    </Pop>
  )
}
