import { add, clock, days, monday, MONTHS, today, WEEK } from '@social-grid/core/day.ts'
import { find } from '@social-grid/core/network/index.ts'
import { open, slots, type Slot } from '@social-grid/core/plan/slots.ts'
import type { Post } from '@social-grid/core/post/post.ts'
import { stats } from '@social-grid/core/project/project.ts'
import { ChevronLeft, ChevronRight, Clock, Plus, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { PostMenu } from '../components/menu.tsx'
import { PostIcon, useName } from '../components/project.tsx'
import { Desk, useMobile } from '../components/shell.tsx'
import { color, NetIcon, Seg, St } from '../components/ui.tsx'
import { ago, kind, label, late, next, short, spin, until } from '../lib/fmt.ts'
import { ask, novo } from '../lib/novo.ts'
import { useNow } from '../lib/now.ts'
import { list, useStore } from '../lib/store.ts'
import { useView } from './view.ts'
import { Week } from './week.tsx'

const NETS = ['instagram', 'linkedin']

function useAgenda(from: string, to: string, nets?: Set<string>) {
  const posts = useStore((s) => s.posts)
  const config = useStore((s) => s.config)
  return useMemo(() => {
    const all = list(posts).filter((p) => !nets || nets.has(p.network))
    const empty = config ? open(slots(config, from, to, all)).filter((s) => !nets || nets.has(s.net)) : []
    return { all, empty }
  }, [posts, config, from, to, nets])
}

export function Agenda() {
  const mobile = useMobile()
  const mode = useView((s) => s.mode)
  const [nets, setNets] = useState(() => new Set(NETS))
  const toggle = (n: string) => {
    const next = new Set(nets)
    if (next.has(n) && next.size > 1) next.delete(n)
    else next.add(n)
    setNets(next)
  }
  if (mobile) return <MobileAgenda />
  return (
    <Desk cols="grid-cols-[1fr_380px]">
      <section className="card flex min-h-0 flex-col px-8 pt-8 pb-6">{mode === 'semana' ? <Week nets={nets} /> : <Month nets={nets} toggle={toggle} />}</section>
      <Side />
    </Desk>
  )
}

function Month({ nets, toggle }: { nets: Set<string>; toggle: (n: string) => void }) {
  const [, go] = useLocation()
  const { anchor, mode, set } = useView()
  const first = `${anchor.slice(0, 7)}-01`
  const start = monday(first)
  const cells = days(start, add(start, 41))
  const { all, empty } = useAgenda(start, add(start, 41), nets)
  const clockNow = useNow()
  const now = today(clockNow)
  const hm = clock(clockNow)
  const month = anchor.slice(0, 7)
  const inMonth = all.filter((p) => p.date?.startsWith(month))
  const nextWeek = add(monday(now), 7)
  const weekGaps = useAgenda(nextWeek, add(nextWeek, 6), nets).empty.length
  const year = anchor.slice(0, 4)
  const name = MONTHS[Number(anchor.slice(5, 7)) - 1]!
  const shift = (n: number) => {
    const d = new Date(Number(year), Number(anchor.slice(5, 7)) - 1 + n, 1)
    set({ anchor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` })
  }
  const posted = inMonth.filter((p) => p.status === 'posted').length
  const ready = inMonth.filter((p) => p.status === 'ready').length

  return (
    <>
      <div className="flex items-start gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] first-letter:uppercase">
            {name} {year}
          </h1>
          <p className="mt-1 max-w-[560px] text-[15px] text-text-muted">
            {posted} {posted === 1 ? 'post feito' : 'posts feitos'}, {ready} {ready === 1 ? 'pronto' : 'prontos'}.{' '}
            {weekGaps ? `Semana que vem ainda tem ${weekGaps} ${weekGaps === 1 ? 'slot vazio' : 'slots vazios'}.` : 'Semana que vem está coberta.'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {NETS.map((n) => (
            <button key={n} className={`chip ${nets.has(n) ? '' : 'off'}`} onClick={() => toggle(n)}>
              <span className="size-[7px] rounded-full" style={{ background: color(n) }} />
              {find(n)?.name}
            </button>
          ))}
          <Seg value={mode} options={[['mes', 'Mês'], ['semana', 'Semana']]} set={(m) => set({ mode: m })} />
          <button className="rnd" aria-label="Mês anterior" onClick={() => shift(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button className="rnd" aria-label="Próximo mês" onClick={() => shift(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-7 text-center text-xs font-bold tracking-[.08em] text-text-faint uppercase">
        {WEEK.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="mt-2 grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {cells.map((d) =>
          d.startsWith(month) ? (
            <Day key={d} d={d} now={now} hm={hm} posts={all.filter((p) => p.date === d)} gaps={empty.filter((s) => s.date === d)} open={(p) => go(`/post/${p.id}`)} />
          ) : (
            <div key={d} />
          ),
        )}
      </div>
      <div className="mt-4 flex items-center gap-5 border-t border-border pt-4 text-[12.5px] font-semibold text-text-muted">
        {[
          ['var(--color-ready)', 'Pronto'],
          ['var(--color-draft)', 'Rascunho'],
          ['var(--color-posted)', 'Postado'],
        ].map(([c, l]) => (
          <span key={l} className="flex items-center gap-[7px]">
            <i className="size-[9px] rounded-full" style={{ background: c }} />
            {l}
          </span>
        ))}
        <span className="flex items-center gap-[7px]">
          <i className="h-3 w-4 rounded-md border-[1.5px] border-dashed border-text-faint" />
          Slot da config, sem post
        </span>
      </div>
    </>
  )
}

function Day({ d, now, hm, posts, gaps, open: openPost }: { d: string; now: string; hm: string; posts: Post[]; gaps: Slot[]; open: (p: Post) => void }) {
  const [, go] = useLocation()
  const past = d < now
  const isToday = d === now
  const soon = d >= now && d <= add(now, 7)
  const sorted = [...posts].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  const shown = sorted.slice(0, 2)
  const live = gaps.filter((s) => !(isToday && s.time <= hm))
  const g = live[0]
  return (
    <div className="relative flex min-h-0 flex-col items-center justify-center gap-1.5">
      {posts.length ? (
        <>
          <span className={`absolute top-1/2 left-1/2 -mt-[31px] -ml-[31px] size-[62px] rounded-full ${isToday ? 'shadow-[0_0_0_2px_var(--color-primary)]' : 'bg-surface-3'}`} />
          <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2">
            {shown.map((p, i) => (
              <PostMenu key={p.id} post={p}>
                <button title={p.title} onClick={() => openPost(p)} className={i ? '-ml-3.5 mt-[22px]' : ''}>
                  <PostIcon post={p} dot rot={spin(p.id)} />
                </button>
              </PostMenu>
            ))}
          </div>
          {posts.length > 2 && <span className="absolute right-[18%] bottom-[8%] text-[11px] font-extrabold text-text-muted">+{posts.length - 2}</span>}
        </>
      ) : (
        <>
          <span
            className={`text-[27px] leading-none font-normal tracking-[-0.01em] ${past ? 'text-text-faint' : ''} ${isToday ? 'grid size-[46px] place-items-center rounded-full bg-primary text-[22px] font-bold text-on-primary' : ''}`}
          >
            {Number(d.slice(8))}
          </span>
          {g && (
            <button className={`slot ${soon ? 'soon' : ''}`} title="Criar post neste slot" onClick={() => void novo({ network: g.net, format: g.format, date: g.date, time: g.time }, go)}>
              <span className="dot" style={{ background: color(g.net) }} />
              {g.time}
              {live.length > 1 ? ` +${live.length - 1}` : ''}
            </button>
          )}
        </>
      )}
    </div>
  )
}

export function Side() {
  return (
    <aside className="flex min-h-0 flex-col gap-6">
      <Today />
      <Todo />
    </aside>
  )
}

function Today() {
  const posts = useStore((s) => s.posts)
  const now = useNow()
  const day = today(now)
  const todays = list(posts)
    .filter((p) => p.date === day)
    .sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
  const first = next(todays)
  const rest = todays.filter((p) => p !== first)
  return (
    <section className="card flex-none p-6">
      <div className="sh">
        <h2>Hoje</h2>
        <small>{label(day)}</small>
      </div>
      {first ? <Next p={first} now={now} /> : <p className="mt-4 text-[13.5px] font-semibold text-text-muted">{todays.length ? 'Tudo de hoje já foi postado.' : 'Nada marcado pra hoje.'}</p>}
      {rest.map((p) => (
        <PostMenu key={p.id} post={p}>
          <Link href={`/post/${p.id}`} className="flex items-center gap-3 px-1 pt-3">
            <PostIcon post={p} size={36} sm />
            <div className="min-w-0 flex-1">
              <b className="block truncate text-sm">{p.title}</b>
              <small className="block truncate text-[12.5px] font-semibold text-text-muted">
                <ProjectName id={p.project} /> · {kind(p)}
              </small>
            </div>
            <div className="text-right">
              <span className="hr">{p.time ?? ''}</span>
              <br />
              <St status={p.status} className="mt-1" />
            </div>
          </Link>
        </PostMenu>
      ))}
    </section>
  )
}

function ProjectName({ id }: { id: string }) {
  return <>{useName(id)}</>
}

function Next({ p, now }: { p: Post; now: Date }) {
  const left = until(p, now)
  const overdue = late(p, now)
  return (
    <PostMenu post={p}>
      <Link href={`/post/${p.id}`} className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4 hover:border-border-strong">
        <div className="flex items-center gap-3">
          <PostIcon post={p} />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[14.5px]">{p.title}</b>
            <small className="text-[12.5px] font-semibold text-text-muted">{kind(p)}</small>
          </div>
          <span className="hr">{p.time ?? ''}</span>
        </div>
        <div className="flex items-center gap-3">
          <St status={p.status} />
          {overdue && (
            <span className="st late">
              <span>Atrasado</span>
            </span>
          )}
          {left && (
            <span className={`ml-auto flex items-center gap-2 text-[12.5px] font-bold ${p.status === 'ready' ? 'text-ready' : 'text-draft'}`}>
              <Clock size={14} />
              {left}
            </span>
          )}
        </div>
      </Link>
    </PostMenu>
  )
}

function Todo() {
  const [, go] = useLocation()
  const now = useNow()
  const day = today(now)
  const hm = clock(now)
  const { empty } = useAgenda(day, add(day, 7))
  const gaps = empty.filter((s) => s.date > day || s.time > hm)
  const projects = useStore((s) => s.projects)
  const posts = useStore((s) => s.posts)
  const all = list(posts)
  const lastPosted = all.filter((p) => p.postedAt && p.project !== 'geral').sort((a, b) => (b.postedAt ?? '').localeCompare(a.postedAt ?? ''))[0]
  const quiet = projects.find((p) => stats(p, all).quiet)
  const lastName = projects.find((p) => p.id === lastPosted?.project)?.name
  const big = gaps.slice(0, 2)
  const groups = new Map<string, Slot[]>()
  for (const s of gaps.slice(2)) groups.set(s.date, [...(groups.get(s.date) ?? []), s])
  const pick = quiet?.id ?? projects[0]?.id

  return (
    <section className="card flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-6 scroll-none">
      <div className="sh">
        <h2>Falta preparar</h2>
        <small>próximos 7 dias</small>
      </div>
      {!gaps.length && <p className="text-[13.5px] font-semibold text-text-muted">Todos os slots da semana têm post. Boa.</p>}
      {big.map((s, i) => {
        const net = find(s.net)
        return (
          <div key={`${s.date}${s.time}${s.net}`} className={`sc ${s.net}`}>
            <div className="flex items-center gap-2 text-[13px] font-extrabold">
              <NetIcon net={s.net} size={16} strokeWidth={2.2} />
              {net?.name} · {s.format}
              <span className="ml-auto font-mono text-[12.5px] font-medium">
                {short(s.date)} · {s.time}
              </span>
            </div>
            <p className="text-[15px] leading-[1.35] font-semibold">
              {i === 0 && (lastName || quiet) ? (
                <>
                  Slot vazio.
                  {lastName && lastPosted?.postedAt && (
                    <>
                      {' '}
                      Último post de <b className="font-extrabold">{lastName}</b> foi {ago(lastPosted.postedAt)}
                      {quiet ? ';' : '.'}
                    </>
                  )}
                  {quiet && (
                    <>
                      {' '}
                      <b className="font-extrabold">{quiet.name}</b> nunca foi divulgado.
                    </>
                  )}
                </>
              ) : (
                'Slot vazio. Escolha um projeto ou peça uma ideia.'
              )}
            </p>
            <div className="flex gap-2">
              <Link className="pill black h-[38px] flex-1" href={ask({ project: pick, slot: s })}>
                <Sparkles size={16} />
                Criar com IA
              </Link>
              <button className="pill line h-[38px] px-3.5" aria-label="Criar post" onClick={() => void novo({ network: s.net, format: s.format, date: s.date, time: s.time }, go)}>
                <Plus size={16} />
              </button>
            </div>
          </div>
        )
      })}
      {[...groups.entries()].map(([d, ss]) => {
        const net = ss[0]!.net
        const same = ss.every((s) => s.net === net)
        const fmts = [...new Set(ss.map((s) => s.format))].join(' + ')
        return (
          <button key={d} className={`sc ${same ? net : 'instagram'} text-left opacity-75 hover:opacity-100`} onClick={() => go(ask({ project: pick, slot: ss[0]! }))}>
            <div className="flex items-center gap-2 text-[13px] font-extrabold">
              <NetIcon net={net} size={16} strokeWidth={2.2} />
              {same ? find(net)?.name : 'Redes'} · {fmts}
              <span className="ml-auto font-mono text-[12.5px] font-medium">{short(d)}</span>
            </div>
            <p className="text-[15px] leading-[1.35] font-semibold">
              {ss.length === 1 ? `Slot vazio às ${ss[0]!.time}.` : `${ss.length} slots vazios: ${ss.map((s) => s.time).join(' e ')}.`}
            </p>
          </button>
        )
      })}
    </section>
  )
}

function MobileAgenda() {
  const [, go] = useLocation()
  const { anchor, set } = useView()
  const now = today(useNow())
  const [pick, setSel] = useState<string | null>(null)
  const sel = pick ?? now
  const month = anchor.slice(0, 7)
  const start = monday(`${month}-01`)
  const cells = days(start, add(start, 41))
  const { all, empty } = useAgenda(start, add(start, 41))
  const shift = (n: number) => {
    const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1)
    set({ anchor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` })
  }
  const dayPosts = all.filter((p) => p.date === sel).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  const dayGaps = empty.filter((s) => s.date === sel)
  return (
    <div className="flex flex-col gap-4 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-28">
      <div className="flex items-end justify-between px-1 pt-4">
        <h1 className="text-[28px] leading-none font-extrabold tracking-[-0.02em] first-letter:uppercase">
          {MONTHS[Number(month.slice(5, 7)) - 1]} <span className="text-text-faint">{month.slice(0, 4)}</span>
        </h1>
        <div className="flex gap-2">
          <button className="rnd" aria-label="Mês anterior" onClick={() => shift(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button className="rnd" aria-label="Próximo mês" onClick={() => shift(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <section className="card p-3">
        <div className="grid grid-cols-7 text-center text-[10.5px] font-bold tracking-[.06em] text-text-faint uppercase">
          {WEEK.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7">
          {cells.map((d) => {
            if (!d.startsWith(month)) return <span key={d} />
            const ps = all.filter((p) => p.date === d)
            const gs = empty.filter((s) => s.date === d)
            return (
              <button key={d} onClick={() => setSel(d)} className={`flex h-12 flex-col items-center justify-center gap-1 rounded-md ${sel === d ? 'bg-surface-3' : ''}`}>
                <span className={`text-[15px] ${d === now ? 'grid size-7 place-items-center rounded-full bg-primary font-bold text-on-primary' : d < now ? 'text-text-faint' : ''}`}>{Number(d.slice(8))}</span>
                <span className="flex h-1.5 gap-0.5">
                  {ps.slice(0, 3).map((p) => (
                    <i key={p.id} className="size-1.5 rounded-full" style={{ background: p.status === 'posted' ? 'var(--color-posted)' : color(p.network) }} />
                  ))}
                  {!ps.length && gs.length > 0 && <i className="size-1.5 rounded-full border border-dashed border-text-faint" />}
                </span>
              </button>
            )
          })}
        </div>
      </section>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[17px] font-bold">{label(sel)}</h2>
        <button className="text-[13px] font-bold text-text-muted" onClick={() => void novo({ date: sel }, go)}>
          + post
        </button>
      </div>
      {dayPosts.map((p) => (
        <Link key={p.id} href={`/post/${p.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
          <PostIcon post={p} size={40} sm dot />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[14.5px]">{p.title}</b>
            <small className="text-[12.5px] font-semibold text-text-muted">{kind(p)}</small>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="hr">{p.time ?? ''}</span>
            <St status={p.status} />
          </div>
        </Link>
      ))}
      {dayGaps.map((s) => (
        <div key={`${s.net}${s.time}`} className="flex items-center gap-3 rounded-xl border-[1.5px] border-dashed border-border-strong p-3">
          <span className="dot" style={{ background: color(s.net) }} />
          <span className="flex-1 text-[13.5px] font-bold text-text-muted">
            {find(s.net)?.name} · {s.format} · <span className="font-mono">{s.time}</span>
          </span>
          <Link className="pill ai sm" href={ask({ slot: s })}>
            <Sparkles size={14} />
            IA
          </Link>
          <button className="pill ghost sm" aria-label="Criar post" onClick={() => void novo({ network: s.net, format: s.format, date: s.date, time: s.time }, go)}>
            <Plus size={14} />
          </button>
        </div>
      ))}
      {!dayPosts.length && !dayGaps.length && <p className="px-1 text-[13.5px] font-semibold text-text-faint">Nada neste dia.</p>}
    </div>
  )
}
