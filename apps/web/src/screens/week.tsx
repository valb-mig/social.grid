import { add, days, monday, MONTHS, today, WEEK } from '@social-grid/core/day.ts'
import { open, slots } from '@social-grid/core/plan/slots.ts'
import type { Post } from '@social-grid/core/post/post.ts'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useLocation } from 'wouter'
import { ProjectIcon } from '../components/project.tsx'
import { color, Seg, St } from '../components/ui.tsx'
import { novo } from '../lib/novo.ts'
import { useNow } from '../lib/now.ts'
import { list, useStore } from '../lib/store.ts'
import { useView } from './view.ts'

const FRESH = 3 * 60_000

function title(from: string, to: string) {
  const a = MONTHS[Number(from.slice(5, 7)) - 1]!
  const b = MONTHS[Number(to.slice(5, 7)) - 1]!
  return a === b ? `${Number(from.slice(8))} a ${Number(to.slice(8))} de ${a}` : `${Number(from.slice(8))} de ${a} a ${Number(to.slice(8))} de ${b}`
}

export function Week({ nets, alone = false }: { nets?: Set<string>; alone?: boolean }) {
  const [, go] = useLocation()
  const { anchor, mode, set } = useView()
  const posts = useStore((s) => s.posts)
  const config = useStore((s) => s.config)
  const fresh = useStore((s) => s.fresh)
  const from = monday(anchor)
  const to = add(from, 6)
  const now = today(useNow())
  const all = useMemo(() => list(posts).filter((p) => !nets || nets.has(p.network)), [posts, nets])
  const empty = useMemo(() => (config ? open(slots(config, from, to, all)).filter((s) => !nets || nets.has(s.net)) : []), [config, from, to, all, nets])
  const rel = from === monday(now) ? 'Esta semana.' : from === add(monday(now), 7) ? 'Semana que vem.' : ''
  const future = empty.filter((s) => s.date >= now).length

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="flex items-start gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em]">{title(from, to)}</h1>
          <p className="mt-1 text-[15px] text-text-muted">
            {rel} {future ? `${future} ${future === 1 ? 'slot ainda vazio' : 'slots ainda vazios'}.` : 'Nenhum slot vazio pela frente.'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Seg
            value={alone ? 'semana' : mode}
            options={[['mes', 'Mês'], ['semana', 'Semana']]}
            set={(m) => {
              set({ mode: m })
              if (alone && m === 'mes') go('/')
            }}
          />
          <button className="rnd" aria-label="Semana anterior" onClick={() => set({ anchor: add(from, -7) })}>
            <ChevronLeft size={18} />
          </button>
          <button className="rnd" aria-label="Próxima semana" onClick={() => set({ anchor: add(from, 7) })}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-3">
        {days(from, to).map((d, i) => {
          const ps = all.filter((p) => p.date === d).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
          const ss = empty.filter((s) => s.date === d)
          const dim = !ps.length && !ss.length
          return (
            <div
              key={d}
              className={`flex min-w-0 flex-col gap-2 overflow-y-auto rounded-xl p-2 scroll-none ${dim ? 'opacity-45' : ''}`}
              style={{ background: 'color-mix(in srgb, var(--color-surface-2) 55%, transparent)' }}
            >
              <div className="flex items-baseline gap-1.5 px-1 pb-2">
                <small className="text-[11.5px] font-extrabold tracking-[.08em] text-text-faint uppercase">{WEEK[i]}</small>
                <b className={`text-[22px] font-medium ${d === now ? 'text-ai' : ''}`}>{Number(d.slice(8))}</b>
              </div>
              {ps.map((p) => (
                <Item key={p.id} p={p} glow={(fresh[p.id] ?? 0) > Date.now() - FRESH} />
              ))}
              {ss.map((s) => (
                <button
                  key={`${s.net}${s.format}${s.time}`}
                  className="flex h-[58px] flex-none items-center justify-center gap-[7px] rounded-lg border-[1.5px] border-dashed border-border-strong text-xs font-bold text-text-faint hover:border-text-faint hover:text-text-muted"
                  onClick={() => void novo({ network: s.net, format: s.format, date: s.date, time: s.time }, go)}
                >
                  <span className="dot" style={{ background: color(s.net) }} />
                  {s.format === 'feed' || s.format === 'post' ? s.time : `${s.format} ${s.time}`}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Item({ p, glow }: { p: Post; glow: boolean }) {
  const [, go] = useLocation()
  return (
    <button
      className="wk relative flex min-w-0 flex-none flex-col gap-2 rounded-lg border bg-surface-2 p-2.5 text-left"
      style={{
        borderColor: glow ? color(p.network) : 'var(--color-border)',
        boxShadow: glow ? `0 0 0 4px color-mix(in srgb, ${color(p.network)} 18%, transparent)` : undefined,
        opacity: p.status === 'posted' ? 0.6 : 1,
      }}
      onClick={() => go(`/post/${p.id}`)}
    >
      {glow && (
        <span className="absolute -top-2.5 right-2.5 grid h-5 place-items-center rounded-full px-2 text-[10.5px] font-extrabold text-on-accent" style={{ background: color(p.network) }}>
          agora
        </span>
      )}
      <span className="flex min-w-0 items-center gap-1.5">
        <ProjectIcon id={p.project} size={26} radius={8} />
        <span className="dot" style={{ background: color(p.network) }} />
        <span className="hr ml-auto text-xs">{p.time ?? ''}</span>
      </span>
      <b className="text-[13px] leading-[1.3]">{p.title}</b>
      <St status={p.status} className="sm self-start" />
    </button>
  )
}
