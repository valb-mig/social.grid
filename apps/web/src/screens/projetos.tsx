import { stats } from '@social-grid/core/project/project.ts'
import type { Post } from '@social-grid/core/post/post.ts'
import { ArrowLeft, GitCommitHorizontal, Plus, Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'wouter'
import { ProjectIcon } from '../components/project.tsx'
import { Desk, useMobile } from '../components/shell.tsx'
import { Square, St } from '../components/ui.tsx'
import type { Row } from '../lib/api.ts'
import { ago, home, kind, need, when } from '../lib/fmt.ts'
import { ask, novo } from '../lib/novo.ts'
import { list, useStore } from '../lib/store.ts'

type Filter = 'todos' | 'rascunho' | 'pronto' | 'quieto'

const FILTERS: [Filter, string][] = [
  ['todos', 'Todos'],
  ['rascunho', 'Com rascunho'],
  ['pronto', 'Prontos pra postar'],
  ['quieto', 'Sem divulgação'],
]

function useRows() {
  const projects = useStore((s) => s.projects)
  const posts = useStore((s) => s.posts)
  return useMemo(() => {
    const all = list(posts)
    return projects.map((p) => ({ ...p, stats: stats(p, all) }))
  }, [projects, posts])
}

export function Projetos() {
  const { id } = useParams<{ id?: string }>()
  const mobile = useMobile()
  const rows = useRows()
  const root = useStore((s) => s.root)
  const [q, setQ] = useState('')
  const [f, setF] = useState<Filter>('todos')
  const [, go] = useLocation()
  const real = rows.filter((r) => r.id !== 'geral')
  const quiet = real.filter((r) => r.stats.quiet).length
  const shown = rows
    .filter((r) => !q || `${r.name} ${r.id}`.toLowerCase().includes(q.toLowerCase()))
    .filter((r) => f === 'todos' || (f === 'rascunho' ? r.stats.draft > 0 : f === 'pronto' ? r.stats.ready > 0 : r.stats.quiet))
  const sel = rows.find((r) => r.id === id) ?? (mobile ? undefined : shown[0])

  if (mobile && sel) return <Detail row={sel} back />

  const grid = (
    <section className={`flex min-h-0 flex-col gap-5 ${mobile ? 'px-4 pt-[max(20px,env(safe-area-inset-top))] pb-28' : 'card p-8'}`}>
      <div className={`flex flex-none gap-4 ${mobile ? 'flex-col' : 'items-end'}`}>
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em]">Projetos</h1>
          <p className="mt-1 text-[15px] text-text-muted">
            {real.length} {real.length === 1 ? 'repositório' : 'repositórios'} em {home(root, root)}.{' '}
            {quiet ? `${quiet} ainda não ${quiet === 1 ? 'foi divulgado' : 'foram divulgados'}.` : 'Todos com divulgação em dia.'}
          </p>
        </div>
        <label className={`flex h-11 items-center gap-2.5 rounded-full border border-border bg-surface-2 pr-1.5 pl-[18px] text-sm font-semibold text-text-faint ${mobile ? '' : 'ml-auto w-80'}`}>
          <Search size={16} />
          <input className="min-w-0 flex-1 text-text placeholder:text-text-faint" placeholder="Buscar projeto" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="grid size-[34px] place-items-center rounded-full bg-primary text-on-primary">
            <Search size={16} />
          </span>
        </label>
      </div>
      <div className="flex flex-none gap-2 overflow-x-auto scroll-none">
        {FILTERS.map(([k, l]) => (
          <button key={k} className={`chip ${f === k ? 'on' : ''}`} onClick={() => setF(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className={`grid gap-4 ${mobile ? 'grid-cols-1' : 'min-h-0 grid-cols-3 content-start overflow-y-auto scroll-none'}`}>
        {shown.map((r) => (
          <button
            key={r.id}
            onClick={() => go(`/projetos/${r.id}`)}
            className="relative flex flex-col gap-4 rounded-xl border bg-surface-2 p-5 text-left"
            style={{ borderColor: sel?.id === r.id ? 'var(--color-primary)' : 'var(--color-border)', boxShadow: sel?.id === r.id ? '0 0 0 1px var(--color-primary)' : undefined }}
          >
            <div className="flex items-center gap-3">
              <ProjectIcon id={r.id} size={48} radius={14} />
              <div className="min-w-0">
                <b className="block text-base tracking-[-0.01em]">{r.name}</b>
                <small className="block truncate font-mono text-[11.5px] text-text-faint">{home(r.path, root)}</small>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-text-muted">
              <GitCommitHorizontal size={14} />
              {r.id === 'geral' ? 'posts sem projeto' : `${ago(r.last)}${r.week ? ` · ${r.week} ${r.week === 1 ? 'commit' : 'commits'} na semana` : ''}`}
            </div>
            <Counts row={r} />
          </button>
        ))}
      </div>
    </section>
  )

  if (mobile) return grid
  return (
    <Desk cols="grid-cols-[1fr_420px]">
      {grid}
      {sel ? <Detail row={sel} /> : <aside className="card p-6 text-text-muted">Nenhum projeto.</aside>}
    </Desk>
  )
}

function Counts({ row }: { row: Row }) {
  const c: [string, number][] = [
    ['var(--color-draft)', row.stats.draft],
    ['var(--color-ready)', row.stats.ready],
    ['var(--color-posted)', row.stats.posted],
  ]
  return (
    <div className="flex items-center gap-4 text-[12.5px] font-bold text-text-muted">
      {c.map(([color, n]) => (
        <span key={color} className="flex items-center gap-1.5">
          <i className="size-[7px] rounded-full" style={{ background: color }} />
          <b className="text-[13.5px] text-text">{n}</b>
        </span>
      ))}
      {row.stats.quiet && <span className="ml-auto flex h-6 items-center rounded-full bg-draft px-2.5 text-[11px] font-extrabold text-on-accent">Sem divulgação</span>}
    </div>
  )
}

function Detail({ row, back = false }: { row: Row; back?: boolean }) {
  const [, go] = useLocation()
  const posts = useStore((s) => s.posts)
  const root = useStore((s) => s.root)
  const own = list(posts).filter((p) => p.project === row.id)
  const byDate = (a: Post, b: Post) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)
  const groups: [string, Post[], boolean][] = [
    ['Prontos', own.filter((p) => p.status === 'ready' && p.date).sort(byDate), false],
    ['Rascunhos', own.filter((p) => p.status === 'draft' && p.date).sort(byDate), false],
    ['Sem data', own.filter((p) => p.status !== 'posted' && !p.date), false],
    ['Postados', own.filter((p) => p.status === 'posted').sort((a, b) => byDate(b, a)), true],
  ]
  return (
    <aside className={`flex min-h-0 flex-col gap-5 overflow-y-auto scroll-none ${back ? 'px-4 pt-[max(16px,env(safe-area-inset-top))] pb-28' : 'card p-6'}`}>
      {back && (
        <Link href="/projetos" className="rnd mt-2">
          <ArrowLeft size={16} />
        </Link>
      )}
      <div className="flex items-center gap-4">
        <ProjectIcon id={row.id} size={64} radius={18} />
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold tracking-[-0.02em]">{row.name}</h2>
          <small className="block truncate font-mono text-xs text-text-faint">{home(row.path, root)}</small>
        </div>
      </div>
      {row.about && <p className="text-[14.5px] leading-normal text-text-muted">{row.about}</p>}
      <div className="flex gap-2">
        <button className="pill white flex-1" onClick={() => void novo({ project: row.id }, go)}>
          <Plus size={16} />
          Novo post
        </button>
        <Link className="pill ai flex-1" href={ask({ project: row.id })}>
          <Sparkles size={16} />
          Conversar
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            [row.stats.ready, 'Prontos', 'var(--color-ready)'],
            [row.stats.draft, 'Rascunho', 'var(--color-draft)'],
            [row.stats.posted, 'Postados', 'var(--color-text-muted)'],
          ] as const
        ).map(([n, l, c]) => (
          <div key={l} className="rounded-lg border border-border bg-surface-2 px-4 py-3">
            <b className="block text-2xl font-bold tracking-[-0.02em]">{n}</b>
            <span className="text-xs font-bold" style={{ color: c }}>
              {l}
            </span>
          </div>
        ))}
      </div>
      {!own.length && <p className="text-[13.5px] font-semibold text-text-faint">Nenhum post deste projeto ainda.</p>}
      {groups
        .filter(([, ps]) => ps.length)
        .map(([name, ps, dim]) => (
          <div key={name} className="grp">
            <h3 className="mb-2">{name}</h3>
            {ps.map((p) => (
              <Link key={p.id} href={`/post/${p.id}`} className={`flex items-center gap-3 rounded-lg p-3 hover:bg-surface-2 ${dim ? 'opacity-50' : ''}`}>
                <Square net={p.network} />
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{p.title}</b>
                  <small className="block truncate text-[12.5px] font-semibold text-text-muted">
                    {kind(p)}
                    {need(p) ? ` · ${need(p)}` : ''}
                  </small>
                </div>
                {p.date ? <span className="hr">{when(p)}</span> : <St status={p.status} />}
              </Link>
            ))}
          </div>
        ))}
    </aside>
  )
}
