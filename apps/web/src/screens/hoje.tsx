import { add, clock, today } from '@social-grid/core/day.ts'
import { find } from '@social-grid/core/network/index.ts'
import { open, slots } from '@social-grid/core/plan/slots.ts'
import { bundle } from '@social-grid/core/post/ops.ts'
import type { Post } from '@social-grid/core/post/post.ts'
import { Bell, Check, Clock, Copy, Hash, LoaderCircle, Settings2, Share } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { PostIcon } from '../components/project.tsx'
import { Strip } from '../components/slides.tsx'
import { St } from '../components/ui.tsx'
import { kind, late, longDay, next, until } from '../lib/fmt.ts'
import { ask } from '../lib/novo.ts'
import { enable, status, type PushState } from '../lib/push.ts'
import { copy, share, useMedia } from '../lib/share.ts'
import { useNow } from '../lib/now.ts'
import { list, useStore } from '../lib/store.ts'

export function Hoje() {
  const posts = useStore((s) => s.posts)
  const config = useStore((s) => s.config)
  const live = useStore((s) => s.live)
  const now = useNow()
  const day = today(now)
  const hm = clock(now)
  const all = list(posts)
  const todays = all.filter((p) => p.date === day).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
  const first = next(todays)
  const later = todays.filter((p) => p !== first)
  const soon = all.filter((p) => p.date && p.date > day && p.date <= add(day, 3) && p.status !== 'posted').sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  const gaps = config ? open(slots(config, day, add(day, 6), all)).filter((s) => s.date > day || s.time > hm) : []

  return (
    <div className="flex flex-col gap-4 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-28">
      <div className="flex items-end justify-between px-1 pt-12">
        <div>
          <small className="mb-1 block text-[13.5px] font-bold text-text-muted">{longDay(day)}</small>
          <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em]">Hoje</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-[30px] items-center gap-1.5 rounded-full border border-border px-3 text-xs font-bold text-text-muted">
            <i className="size-[7px] rounded-full" style={{ background: live ? 'var(--color-ready)' : 'var(--color-danger)' }} />
            PC
          </span>
          <Link href="/config/celular" className="rnd size-[30px]" aria-label="Config">
            <Settings2 size={15} />
          </Link>
        </div>
      </div>
      <PushHint />
      {first ? <Big p={first} now={now} /> : <Nothing gaps={gaps.length} />}
      {later.length > 0 && <List title="Depois" posts={later} />}
      {soon.length > 0 && <List title="Próximos dias" posts={soon} days />}
    </div>
  )
}

function PushHint() {
  const [state, setState] = useState<PushState | null>(null)
  useEffect(() => {
    void status().then(setState)
  }, [])
  if (state !== 'off') return null
  return (
    <button className="flex items-center gap-3 rounded-xl border border-dashed border-border-strong p-4 text-left text-[13px] font-semibold text-text-muted" onClick={() => void enable().then(setState)}>
      <Bell size={18} className="flex-none text-text" />
      <span>
        <b className="block text-[13.5px] text-text">Ativar avisos neste celular</b>O aviso chega antes de cada post pronto, com tudo pra colar.
      </span>
    </button>
  )
}

function Nothing({ gaps }: { gaps: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <b className="text-[15.5px]">Nada pra postar agora.</b>
      <p className="text-[13.5px] text-text-muted">{gaps ? `A semana tem ${gaps} ${gaps === 1 ? 'slot vazio' : 'slots vazios'}.` : 'A semana está coberta.'}</p>
      {gaps > 0 && (
        <Link href={ask({})} className="btn g">
          Pedir um post à IA
        </Link>
      )}
    </div>
  )
}

function Big({ p, now }: { p: Post; now: Date }) {
  const [, go] = useLocation()
  const move = useStore((s) => s.move)
  const fail = useStore((s) => s.fail)
  const [flash, setFlash] = useState('')
  const pk = bundle(p)
  const left = until(p, now)
  const overdue = late(p, now)
  const net = find(p.network)
  const media = useMedia(p)
  const say = (t: string) => {
    setFlash(t)
    setTimeout(() => setFlash(''), 2200)
  }
  const [first, ...rest] = pk.caption.split('\n')
  return (
    <div className="relative flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      {flash && (
        <div className="fixed top-[max(12px,env(safe-area-inset-top))] left-1/2 z-40 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-ready px-[18px] text-[13.5px] font-extrabold whitespace-nowrap text-on-accent shadow-[var(--shadow-pop)]">
          <Check size={16} />
          {flash}
        </div>
      )}
      <button className="flex items-center gap-2.5 text-left" onClick={() => go(`/post/${p.id}`)}>
        <PostIcon post={p} size={42} />
        <div className="min-w-0">
          <b className="block truncate text-[15.5px]">{p.title}</b>
          <small className="text-[12.5px] font-bold text-text-muted">{kind(p)}</small>
        </div>
        <span className="hr ml-auto text-[15px]">{p.time ?? ''}</span>
      </button>
      <Strip post={p} />
      {pk.caption && (
        <p className="text-[13.5px] leading-[1.45] text-text-muted">
          <b className="text-text">{first}</b> {rest.join(' ').trim().slice(0, 90)}
          {rest.join(' ').length > 90 ? '...' : ''}
        </p>
      )}
      {left && (
        <span className={`flex items-center gap-1.5 text-[12.5px] font-extrabold ${p.status === 'ready' ? 'text-ready' : 'text-draft'}`}>
          <Clock size={14} />
          {left}
          {p.status === 'draft' && <St status="draft" className="ml-1" />}
        </span>
      )}
      {overdue && (
        <span className="flex items-center gap-1.5">
          <span className="st late">
            <span>Atrasado</span>
          </span>
          <St status={p.status} />
        </span>
      )}
      {media.state === 'error' ? (
        <div className="flex items-center gap-3 rounded-lg border border-danger/40 px-3.5 py-2.5 text-[13px] font-bold text-danger">
          <span className="flex-1">A mídia não baixou do PC.</span>
          <button className="pill ghost sm" onClick={media.retry}>
            Tentar de novo
          </button>
        </div>
      ) : (
        <button
          className="btn w"
          disabled={media.state === 'loading'}
          onClick={async () => {
            const r = await share(pk.text, media.list)
            if (r.k === 'shared') say('Legenda copiada. Cole no app.')
            if (r.k === 'unsupported') say('Legenda copiada; este navegador não manda arquivos')
            if (r.k === 'failed') fail(r.why)
          }}
        >
          {media.state === 'loading' ? <LoaderCircle size={18} className="animate-spin" /> : <Share size={18} />}
          {media.state === 'loading' ? 'Preparando mídia…' : `Compartilhar no ${net?.name}`}
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn g" onClick={async () => (await copy(pk.caption)) && say('Legenda copiada')}>
          <Copy size={16} />
          Legenda
        </button>
        <button className="btn g" onClick={async () => (await copy(pk.tags)) && say('Hashtags copiadas')}>
          <Hash size={16} />
          Hashtags
        </button>
      </div>
      {p.comment && (
        <button className="btn g" onClick={async () => (await copy(pk.comment)) && say('Comentário copiado')}>
          <Copy size={16} />
          Comentário com o link
        </button>
      )}
      {p.status === 'ready' ? (
        <button className="btn ok" onClick={() => void move(p.id, 'posted')}>
          <Check size={16} />
          Marcar postado
        </button>
      ) : (
        <button className="btn ok" onClick={() => void move(p.id, 'ready')}>
          <Check size={16} />
          Marcar pronto
        </button>
      )}
    </div>
  )
}

function List({ title, posts, days = false }: { title: string; posts: Post[]; days?: boolean }) {
  return (
    <div>
      <h3 className="mx-1 mb-2 text-xs font-extrabold tracking-[.08em] text-text-faint uppercase">{title}</h3>
      {posts.map((p) => (
        <Link key={p.id} href={`/post/${p.id}`} className="flex items-center gap-3 px-1 py-2.5">
          <PostIcon post={p} size={36} sm />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-sm">{p.title}</b>
            <small className="text-xs font-bold text-text-muted">
              {days && p.date ? longDay(p.date) : 'hoje'}
              {p.time ? ` · ${p.time}` : ''}
            </small>
          </div>
          <St status={p.status} />
        </Link>
      ))}
    </div>
  )
}
