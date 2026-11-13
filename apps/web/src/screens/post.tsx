import { label as dayLabel } from '@social-grid/core/day.ts'
import { kind as mediaKind } from '@social-grid/core/media.ts'
import { find, get, rules, slot } from '@social-grid/core/network/index.ts'
import { hook, len, num, type Issue } from '@social-grid/core/network/net.ts'
import { slots } from '@social-grid/core/plan/slots.ts'
import { bundle, check } from '@social-grid/core/post/ops.ts'
import { GERAL, line, patch as merge, type Changes, type Post, type Status } from '@social-grid/core/post/post.ts'
import { Archive, ArrowLeft, Calendar, Check, ChevronDown, Clock, Copy, Ellipsis, GripVertical, Hash, Heart, LoaderCircle, MessageCircle, Plus, Send, Share, Smartphone, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'wouter'
import { ProjectIcon, useName } from '../components/project.tsx'
import { useMobile } from '../components/shell.tsx'
import { color, NetIcon, St, statusName } from '../components/ui.tsx'
import { api, ApiError } from '../lib/api.ts'
import { ask } from '../lib/novo.ts'
import { copy, share, useMedia } from '../lib/share.ts'
import { list, useStore } from '../lib/store.ts'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm'

type Edit = {
  post: Post
  issues: Issue[]
  saved: 'ok' | 'saving' | 'error'
  change(c: Changes, now?: boolean): void
  move(to: Status): Promise<void>
  upload(list: FileList | File[]): Promise<void>
  busy: boolean
}

const KEYS: (keyof Post)[] = ['project', 'network', 'format', 'type', 'status', 'date', 'time', 'title', 'caption', 'comment', 'postedAt', 'updatedAt', 'archived']

const same = (a: Post, b: Post) => KEYS.every((k) => a[k] === b[k]) && a.hashtags.join('\n') === b.hashtags.join('\n') && a.media.join('\n') === b.media.join('\n')

function useEdit(id: string): Edit | null {
  const fail = useStore((s) => s.fail)
  const note = useStore((s) => s.note)
  const put = useStore((s) => s.put)
  const stored = useStore((s) => s.posts[id])
  const [local, setLocal] = useState<Post | null>(stored ?? null)
  const [saved, setSaved] = useState<Edit['saved']>('ok')
  const [busy, setBusy] = useState(false)
  const base = useRef<string | undefined>(stored?.updatedAt)
  const pending = useRef<Changes>({})
  const flying = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const chain = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    if (!stored) void api.post(id).then((r) => put(r.post), () => fail('post não encontrado'))
  }, [id, stored, put, fail])

  useEffect(() => {
    if (!stored || Object.keys(pending.current).length || flying.current) return
    base.current = stored.updatedAt
    setLocal((cur) => (cur && same(cur, stored) ? cur : stored))
  }, [stored])

  const flush = () => {
    clearTimeout(timer.current)
    const c = pending.current
    if (!Object.keys(c).length) return
    pending.current = {}
    setSaved('saving')
    flying.current++
    chain.current = chain.current.then(async () => {
      try {
        const r = await api.patch(id, c, base.current)
        base.current = r.post.updatedAt
        if (!Object.keys(pending.current).length) setLocal(r.post)
        put(r.post)
        setSaved('ok')
      } catch (e) {
        setSaved('error')
        if (e instanceof ApiError && e.status === 409) {
          fail('o post mudou em outro lugar; recarreguei a versão nova')
          const r = await api.post(id)
          pending.current = {}
          base.current = r.post.updatedAt
          put(r.post)
          setLocal(r.post)
        } else fail(e instanceof Error ? e.message : 'não deu para salvar')
      } finally {
        flying.current--
      }
    })
  }

  useEffect(() => () => flush(), [])

  if (!local) return null
  const issues = check(local)
  return {
    post: local,
    issues,
    saved,
    busy,
    change(c, now = false) {
      pending.current = { ...pending.current, ...c }
      setLocal((p) => (p ? { ...merge(p, c, new Date(p.updatedAt)), updatedAt: p.updatedAt } : p))
      clearTimeout(timer.current)
      if (now) flush()
      else timer.current = setTimeout(flush, 700)
    },
    async move(to) {
      flush()
      await chain.current
      try {
        const r = await api.move(id, to)
        base.current = r.post.updatedAt
        put(r.post)
        setLocal(r.post)
      } catch (e) {
        fail(e instanceof Error ? e.message : 'não deu para mudar o status')
      }
    },
    async upload(list) {
      flush()
      await chain.current
      setBusy(true)
      try {
        for (const f of Array.from(list)) {
          const r = await api.upload(id, f)
          base.current = r.post.updatedAt
          put(r.post)
          setLocal(r.post)
          if (r.grew) note('Virou carrossel: o feed aceita 1 mídia, e com 2 ou mais o post passa a ser carrossel.')
        }
      } catch (e) {
        fail(e instanceof Error ? e.message : 'falha no envio')
      } finally {
        setBusy(false)
      }
    },
  }
}

export function PostScreen() {
  const { id } = useParams<{ id: string }>()
  return <One key={id} id={id} />
}

function One({ id }: { id: string }) {
  const mobile = useMobile()
  const e = useEdit(id)
  const [steps, setSteps] = useState<boolean | null>(null)
  if (!e) return <div className="p-8 text-text-muted">Carregando…</div>
  const showSteps = steps ?? (e.post.status !== 'draft')
  if (mobile) return showSteps ? <Steps e={e} edit={() => setSteps(false)} /> : <MobileEditor e={e} steps={() => setSteps(true)} />
  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_330px_340px] gap-5 px-6 pb-6">
      <Editor e={e} />
      <Settings e={e} />
      <Preview post={e.post} />
    </div>
  )
}

function Crumb({ e }: { e: Edit }) {
  const name = useName(e.post.project)
  return (
    <div className="flex items-center gap-2 text-[13.5px] font-bold whitespace-nowrap text-text-muted">
      <button className="rnd mr-2 size-[34px]" aria-label="Voltar" onClick={() => history.length > 1 ? history.back() : (location.href = '/')}>
        <ArrowLeft size={16} />
      </button>
      <Link href="/">Agenda</Link>
      <span className="text-text-faint">/</span>
      <Link href={`/projetos/${e.post.project}`}>{name}</Link>
      <span className="text-text-faint">/</span>
      <Title e={e} className="min-w-0 flex-1 truncate font-bold text-text" />
      <span className="mr-3 text-[12.5px] font-semibold text-text-faint">{e.saved === 'saving' ? 'Salvando…' : e.saved === 'error' ? 'Não salvou' : 'Salvo'}</span>
      <Link className="pill ai sm" href={ask({ project: e.post.project, post: e.post.id })}>
        <Sparkles size={14} />
        Pedir ajuste à IA
      </Link>
    </div>
  )
}

function Title({ e, className }: { e: Edit; className: string }) {
  const [raw, setRaw] = useState(e.post.title)
  const typing = useRef(false)
  useEffect(() => {
    if (!typing.current) setRaw(e.post.title)
  }, [e.post.title])
  const done = () => {
    typing.current = false
    const t = line(raw) || 'Post sem título'
    setRaw(t)
    if (t !== e.post.title) e.change({ title: t }, true)
  }
  return (
    <input
      className={className}
      value={raw}
      maxLength={140}
      aria-label="Título"
      onFocus={() => (typing.current = true)}
      onChange={(ev) => {
        setRaw(ev.target.value)
        if (line(ev.target.value)) e.change({ title: ev.target.value })
      }}
      onBlur={done}
      onKeyDown={(ev) => ev.key === 'Enter' && ev.currentTarget.blur()}
    />
  )
}

function Editor({ e }: { e: Edit }) {
  const net = get(e.post.network)
  return (
    <section className="card flex min-h-0 flex-col gap-5 overflow-y-auto px-8 py-6 scroll-none">
      <Crumb e={e} />
      <Media e={e} />
      <div className="lbl -mb-2">
        <h3>Legenda</h3>
        <small>gancho até {net.hook} letras</small>
      </div>
      <Caption e={e} />
      <Tags e={e} />
      {(e.post.network === 'linkedin' || e.post.comment) && <Comment e={e} />}
    </section>
  )
}

function Thumb({ post, name, className = '' }: { post: Post; name: string; className?: string }) {
  const src = api.media(post.id, name)
  return mediaKind(name) === 'video' ? (
    <video className={`size-full object-cover ${className}`} src={src} muted playsInline preload="metadata" />
  ) : (
    <img className={`size-full object-cover ${className}`} src={src} alt="" draggable={false} />
  )
}

function Media({ e, big = false }: { e: Edit; big?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const f = find(e.post.network)?.formats.find((x) => x.id === e.post.format)
  const media = e.post.media
  const drop = (to: number) => {
    setDrag(null)
    if (drag === null || drag === to) return
    const next = [...media]
    const [m] = next.splice(drag, 1)
    next.splice(to, 0, m!)
    e.change({ media: next }, true)
  }
  const w = big ? 'w-[96px] h-[120px]' : 'w-[112px] h-[140px]'
  return (
    <div>
      <div className="lbl">
        <h3>Mídia</h3>
        <small>
          {media.length} de {f?.max ?? 10}
          {media.length > 1 ? ' · arraste para ordenar' : ''}
          {e.busy ? ' · enviando…' : ''}
        </small>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scroll-none">
        {media.map((m, i) => (
          <div
            key={m}
            draggable
            onDragStart={(ev) => {
              ev.dataTransfer.effectAllowed = 'move'
              ev.dataTransfer.setData('text/plain', m)
              setDrag(i)
            }}
            onDragOver={(ev) => {
              ev.preventDefault()
              ev.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(ev) => {
              ev.preventDefault()
              drop(i)
            }}
            onDragEnd={() => setDrag(null)}
            className={`group relative flex-none overflow-hidden rounded-lg shadow-[var(--shadow-chip)] ${w} ${drag === i ? 'opacity-50' : ''}`}
          >
            <Thumb post={e.post} name={m} />
            <span className="absolute bottom-2 left-2 grid size-6 place-items-center rounded-full bg-primary text-xs font-extrabold text-on-primary">{i + 1}</span>
            <GripVertical size={16} className="absolute top-1.5 right-1.5 text-text opacity-80" />
            <button
              className="absolute top-1.5 left-1.5 hidden size-6 place-items-center rounded-full bg-black/60 group-hover:grid pointer-coarse:grid"
              aria-label="Tirar do post"
              onClick={() => e.change({ media: media.filter((x) => x !== m) }, true)}
            >
              <X size={13} />
            </button>
          </div>
        ))}
        <button
          className={`grid flex-none place-items-center rounded-lg border-[1.5px] border-dashed border-border-strong text-text-faint hover:text-text-muted ${w}`}
          aria-label="Adicionar mídia"
          disabled={e.busy}
          onClick={() => input.current?.click()}
        >
          <Plus size={18} />
        </button>
        <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(ev) => ev.target.files && void e.upload(ev.target.files).then(() => (ev.target.value = ''))} />
      </div>
    </div>
  )
}

function Caption({ e, plain = false }: { e: Edit; plain?: boolean }) {
  const [edit, setEdit] = useState(false)
  const net = get(e.post.network)
  const total = len(bundle(e.post).text)
  const cap = len(e.post.caption.trim())
  const tags = total - cap
  const over = total > net.max
  const c = color(e.post.network)
  const counter = (
    <span
      className={`pointer-events-none absolute right-5 bottom-4 bg-surface-2 pl-2 font-mono text-xs ${over ? 'text-danger' : 'text-text-muted'}`}
      title={tags ? `legenda ${num(cap)} + hashtags ${num(tags)} = ${num(total)} de ${num(net.max)}` : undefined}
    >
      {tags ? `legenda ${num(cap)} + hashtags ${num(tags)} = ${num(total)}` : num(total)} / {num(net.max)}
    </span>
  )
  const box = 'relative min-h-[220px] flex-1 rounded-xl border border-border bg-surface-2 text-[14.5px] leading-[1.55]'
  if (edit || plain || !e.post.caption.trim()) {
    return (
      <div className={box}>
        <textarea
          autoFocus={edit}
          className="absolute inset-0 size-full resize-none px-6 pt-5 pb-10 placeholder:text-text-faint"
          placeholder="Escreva a legenda. A primeira linha é o gancho."
          value={e.post.caption}
          onChange={(ev) => e.change({ caption: ev.target.value })}
          onBlur={() => setEdit(false)}
        />
        {counter}
      </div>
    )
  }
  const lines = e.post.caption.split('\n')
  const first = lines[0] ?? ''
  const h = hook(e.post.caption, net.hook)
  const rest = lines.slice(1).join('\n').trim()
  const paras = rest ? rest.split(/\n\s*\n/) : []
  return (
    <div className={`${box} cursor-text overflow-hidden px-6 pt-5 pb-10`} onClick={() => setEdit(true)}>
      <p>
        <span className="-ml-1 rounded-md px-1 py-px" style={{ background: `color-mix(in srgb, ${c} 16%, transparent)` }}>
          {h.head}
        </span>
        {first.slice(h.head.length)}
      </p>
      {paras.length > 0 && (
        <div className="my-3 flex items-center gap-2 text-[11px] font-extrabold tracking-[.05em]" style={{ color: c }}>
          CORTE DO "MAIS"
          <span className="flex-1 border-t-[1.5px] border-dashed" style={{ borderColor: `color-mix(in srgb, ${c} 55%, transparent)` }} />
        </div>
      )}
      {paras.map((p, i) => (
        <p key={i} className="mt-3 whitespace-pre-line first-of-type:mt-0">
          {p}
        </p>
      ))}
      {counter}
    </div>
  )
}

function Tags({ e }: { e: Edit }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const net = get(e.post.network)
  const many = e.issues.find((i) => i.code.startsWith('tags'))
  const tone = many?.level === 'error' ? 'text-danger' : many?.level === 'warn' ? 'text-draft' : 'text-ready'
  const add = (raw: string) => {
    const parts = raw.split(/[\s,]+/).filter(Boolean)
    if (parts.length) e.change({ hashtags: [...e.post.hashtags, ...parts] }, true)
    setText('')
  }
  return (
    <div>
      <div className="lbl">
        <h3>Hashtags</h3>
        <small className={tone}>
          {e.post.hashtags.length} de {net.cap} · ideal {net.ideal[0]} a {net.ideal[1]}
        </small>
      </div>
      <div className="flex flex-wrap gap-2">
        {e.post.hashtags.map((t) => (
          <span key={t} className="tag">
            #{t}
            <button aria-label={`Tirar #${t}`} onClick={() => e.change({ hashtags: e.post.hashtags.filter((x) => x !== t) }, true)}>
              <X size={13} className="text-text-faint hover:text-text" />
            </button>
          </span>
        ))}
        {open ? (
          <input
            autoFocus
            className="tag add w-40 text-text"
            placeholder="#hashtag"
            value={text}
            onChange={(ev) => (/[\s,]$/.test(ev.target.value) ? add(ev.target.value) : setText(ev.target.value))}
            onKeyDown={(ev) => ev.key === 'Enter' && add(text)}
            onBlur={() => {
              add(text)
              setOpen(false)
            }}
          />
        ) : (
          <button className="tag add" onClick={() => setOpen(true)}>
            + hashtag
          </button>
        )}
      </div>
    </div>
  )
}

function Comment({ e }: { e: Edit }) {
  return (
    <div>
      <div className="lbl">
        <h3>Primeiro comentário</h3>
        <small>{e.post.network === 'linkedin' ? 'o link vai aqui, não no corpo' : 'opcional'}</small>
      </div>
      <textarea className="field min-h-[72px] resize-y" value={e.post.comment} placeholder="https://github.com/..." onChange={(ev) => e.change({ comment: ev.target.value })} />
    </div>
  )
}

function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="fl">
      <h4 className="mb-2">{title}</h4>
      {children}
    </div>
  )
}

function Settings({ e, flat = false }: { e: Edit; flat?: boolean }) {
  const p = e.post
  const projects = useStore((s) => s.projects)
  const config = useStore((s) => s.config)
  const posts = useStore((s) => s.posts)
  const name = useName(p.project)
  const net = get(p.network)
  const hint = useMemo(() => {
    if (!p.date) return 'Sem data: fica na lista "sem data" do projeto'
    if (!p.time) return 'Sem hora: escolha um horário'
    if (!config) return ''
    const others = list(posts).filter((x) => x.id !== p.id)
    const hit = slots(config, p.date, p.date, others).find((s) => s.net === p.network && s.format === slot(p.network, p.format) && s.time === p.time)
    if (hit?.post) return 'Já tem outro post neste slot'
    return hit ? `Ocupa o slot de ${hit.format} das ${hit.time}` : 'Fora dos horários da config'
  }, [p, config, posts])
  const order: Status[] = ['draft', 'ready', 'posted']
  const at = order.indexOf(p.status)
  return (
    <aside className={`flex min-h-0 flex-col gap-5 ${flat ? '' : 'card overflow-y-auto p-6 scroll-none'}`}>
      <Field title="Rede">
        <div className="grid grid-cols-2 gap-1 rounded-full border border-border bg-surface-2 p-1">
          {['instagram', 'linkedin'].map((n) => (
            <button
              key={n}
              className="flex h-9 items-center justify-center gap-2 rounded-full text-[13px] font-extrabold"
              style={n === p.network ? { background: color(n), color: 'var(--color-on-accent)' } : { color: 'var(--color-text-muted)' }}
              onClick={() => n !== p.network && e.change({ network: n, format: rules(n)[0]!.id }, true)}
            >
              <NetIcon net={n} size={15} strokeWidth={2.2} />
              {find(n)?.name}
            </button>
          ))}
        </div>
      </Field>
      <Field title="Formato">
        <div className="flex flex-wrap gap-1.5">
          {net.formats.map((f) => (
            <button key={f.id} className={`chip ${f.id === p.format ? 'on' : ''}`} title={f.hint} onClick={() => e.change({ format: f.id }, true)}>
              {f.name}
            </button>
          ))}
        </div>
      </Field>
      <Field title="Quando">
        <div className="grid grid-cols-[1fr_110px] gap-2">
          <label className="fd cursor-pointer">
            <Calendar size={16} />
            <span className="truncate">{p.date ? dayLabel(p.date) : 'sem data'}</span>
            {p.date && (
              <button className="relative z-10 ml-auto text-text-faint hover:text-text" aria-label="Tirar a data" onClick={(ev) => {
                  ev.preventDefault()
                  e.change({ date: null }, true)
                }}>
                <X size={14} />
              </button>
            )}
            <input
              type="date"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={p.date ?? ''}
              onClick={(ev) => ev.currentTarget.showPicker?.()}
              onChange={(ev) => e.change({ date: ev.target.value || null }, true)}
            />
          </label>
          <label className="fd cursor-pointer font-mono">
            <Clock size={16} />
            {p.time ?? '--:--'}
            <input
              type="time"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={p.time ?? ''}
              onClick={(ev) => ev.currentTarget.showPicker?.()}
              onChange={(ev) => e.change({ time: ev.target.value || null }, true)}
            />
          </label>
        </div>
        <div className="mt-1.5 text-xs font-semibold text-text-faint">{hint}</div>
      </Field>
      <Field title="Projeto">
        <label className="fd cursor-pointer">
          <ProjectIcon id={p.project} size={24} radius={7} className="!shadow-none" />
          <span className="truncate">{name}</span>
          <ChevronDown size={16} className="ml-auto" />
          <select className="absolute inset-0 cursor-pointer opacity-0" value={p.project} onChange={(ev) => e.change({ project: ev.target.value }, true)}>
            {!projects.some((x) => x.id === p.project) && <option value={p.project}>{p.project}</option>}
            {projects.map((x) => (
              <option key={x.id} value={x.id}>
                {x.id === GERAL ? 'geral (sem projeto)' : x.name}
              </option>
            ))}
          </select>
        </label>
      </Field>
      <Field title="Status">
        <div className="flex items-center gap-1.5">
          {order.map((s, i) => (
            <button
              key={s}
              onClick={() => s !== p.status && void e.move(s)}
              className="flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-full border text-[12.5px] font-extrabold"
              style={
                i === at
                  ? { background: s === 'draft' ? 'var(--color-draft)' : s === 'ready' ? 'var(--color-ready)' : 'var(--color-posted)', color: 'var(--color-on-accent)', borderColor: 'transparent' }
                  : i < at
                    ? { color: 'var(--color-draft)', borderColor: 'color-mix(in srgb, var(--color-draft) 40%, transparent)' }
                    : { color: 'var(--color-text-faint)', borderColor: 'var(--color-border)' }
              }
            >
              {i < at && <Check size={14} />}
              {statusName(s)}
            </button>
          ))}
        </div>
      </Field>
      <Field title="Validação">
        <Checks issues={e.issues} />
      </Field>
      {!flat && (
        <button className="mt-auto flex items-center gap-2 self-start text-[12.5px] font-bold text-text-faint hover:text-text-muted" onClick={() => e.change({ archived: !p.archived }, true)}>
          <Archive size={14} />
          {p.archived ? 'Desarquivar' : 'Arquivar post'}
        </button>
      )}
    </aside>
  )
}

function Checks({ issues }: { issues: Issue[] }) {
  return (
    <div className="flex flex-col gap-2 text-[13px] font-semibold text-text-muted">
      {issues.map((i) => (
        <div key={i.code} className="flex items-start gap-2">
          {i.level === 'ok' ? (
            <Check size={15} strokeWidth={2.6} className="mt-0.5 flex-none text-ready" />
          ) : i.level === 'warn' ? (
            <span className="mt-[5px] size-[9px] flex-none rounded-full bg-draft" />
          ) : (
            <X size={15} strokeWidth={2.6} className="mt-0.5 flex-none text-danger" />
          )}
          <span className={i.level === 'error' ? 'text-text' : ''}>{i.text}</span>
        </div>
      ))}
    </div>
  )
}

function Preview({ post }: { post: Post }) {
  const config = useStore((s) => s.config)
  const handle = config?.nets[post.network]?.handle?.replace(/^@/, '') || 'você'
  const net = get(post.network)
  const h = hook(post.caption, net.hook)
  const more = post.caption.trim().length > h.head.length
  const before = config?.push.before ?? 15
  const warn = post.status === 'ready' && post.date && post.time && config?.push.ready
  const notice = (() => {
    if (!warn || !post.time) return null
    const [hh, mm] = post.time.split(':').map(Number)
    const t = (hh! * 60 + mm! - before + 1440) % 1440
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  })()
  const story = post.format === 'story' || post.format === 'reels'
  return (
    <aside className="card flex min-h-0 flex-col gap-3 overflow-y-auto p-5 scroll-none">
      <div className="sh">
        <h2>Prévia</h2>
        <small>{post.network === 'linkedin' ? 'como aparece no feed' : story ? `como aparece no ${post.format}` : 'como aparece no feed'}</small>
      </div>
      {post.network === 'linkedin' ? (
        <div className="overflow-hidden rounded-lg border border-border bg-surface-2">
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <img src="/logo.svg" alt="" className="size-[34px] rounded-full bg-white" />
            <div className="min-w-0 flex-1">
              <b className="block text-[13px]">{handle}</b>
              <small className="text-[11.5px] font-semibold text-text-faint">agora</small>
            </div>
            <Ellipsis size={16} className="text-text-muted" />
          </div>
          <p className="px-3 pb-3 text-[13px] leading-[1.45] whitespace-pre-line">
            {[...post.caption].slice(0, net.hook).join('')}
            {len(post.caption) > net.hook && <span className="text-text-faint">…ver mais</span>}
          </p>
          {post.media[0] && (
            <div className="aspect-[1.2] overflow-hidden">
              <Thumb post={post} name={post.media[0]} />
            </div>
          )}
          <div className="flex justify-around border-t border-border py-2 text-xs font-bold text-text-muted">
            <span>Gostei</span>
            <span>Comentar</span>
            <span>Compartilhar</span>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface-2">
          <div className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-extrabold">
            <img src="/logo.svg" alt="" className="size-[30px] rounded-full bg-white shadow-[0_0_0_2px_var(--color-instagram)]" />
            {handle}
            <Ellipsis size={16} className="ml-auto text-text-muted" />
          </div>
          <div className={`relative overflow-hidden bg-surface-3 ${story ? 'aspect-[9/16]' : 'aspect-[4/5]'}`}>
            {post.media[0] ? <Thumb post={post} name={post.media[0]} /> : <div className="grid size-full place-items-center text-xs font-bold text-text-faint">sem mídia</div>}
            {post.media.length > 1 && <span className="absolute top-2.5 right-2.5 grid h-6 place-items-center rounded-full bg-black/55 px-2.5 text-[11.5px] font-extrabold">1/{post.media.length}</span>}
          </div>
          {!story && (
            <>
              <div className="flex items-center gap-3.5 px-3 pt-2.5 pb-1">
                <Heart size={18} />
                <MessageCircle size={18} />
                <Send size={18} />
                {post.media.length > 1 && (
                  <span className="mx-auto flex items-center gap-1 pr-[60px]">
                    {post.media.slice(0, 10).map((m, i) => (
                      <i key={m} className="size-1.5 rounded-full" style={{ background: i ? 'var(--color-text-faint)' : 'var(--color-linkedin)' }} />
                    ))}
                  </span>
                )}
              </div>
              <p className="px-3 pt-1 pb-3.5 text-[13px] leading-[1.45]">
                <b>{handle}</b> {h.head || <span className="text-text-faint">sem legenda</span>} {more && <span className="text-text-faint">... mais</span>}
              </p>
            </>
          )}
        </div>
      )}
      <div className="mt-auto flex items-start gap-3 rounded-lg border border-dashed border-border-strong p-4 text-[13px] font-semibold text-text-muted">
        <Smartphone size={18} className="mt-px flex-none text-text" />
        <div>
          {notice ? (
            <>
              <b className="mb-0.5 block text-[13.5px] text-text">No celular às {notice}</b>
              Aviso {before} min antes, com mídia, legenda e hashtags prontas pra colar.
            </>
          ) : (
            <>
              <b className="mb-0.5 block text-[13.5px] text-text">No celular</b>
              Quando ficar pronto e com hora marcada, o aviso chega {before} min antes com tudo pra colar.
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

function MobileEditor({ e, steps }: { e: Edit; steps: () => void }) {
  return (
    <div className="flex flex-col gap-5 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-28">
      <div className="flex items-center gap-3 pt-2">
        <button className="rnd" aria-label="Voltar" onClick={() => history.back()}>
          <ArrowLeft size={16} />
        </button>
        <Title e={e} className="min-w-0 flex-1 text-[17px] font-extrabold" />
        <St status={e.post.status} />
      </div>
      <Media e={e} big />
      <div className="flex min-h-[260px] flex-col">
        <div className="lbl">
          <h3>Legenda</h3>
          <small>gancho até {get(e.post.network).hook} letras</small>
        </div>
        <Caption e={e} plain />
      </div>
      <Tags e={e} />
      {(e.post.network === 'linkedin' || e.post.comment) && <Comment e={e} />}
      <Settings e={e} flat />
      {e.post.status !== 'draft' && (
        <button className="btn g" onClick={steps}>
          Ver passo a passo
        </button>
      )}
    </div>
  )
}

function Steps({ e, edit }: { e: Edit; edit: () => void }) {
  const p = e.post
  const pk = bundle(p)
  const key = `sg:passos:${p.id}`
  const [done, setDone] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(key) ?? '[]') as string[]
    } catch {
      return []
    }
  })
  const [just, setJust] = useState('')
  const [, go] = useLocation()
  const media = useMedia(p)
  const fail = useStore((s) => s.fail)
  const mark = (...k: string[]) => {
    const next = [...new Set([...done, ...k])]
    setDone(next)
    setJust(k.at(-1) ?? '')
    try {
      sessionStorage.setItem(key, JSON.stringify(next))
    } catch {}
  }
  const net = get(p.network)
  const prep = media.state === 'loading' ? 'preparando mídia…' : media.state === 'error' ? 'tentar de novo' : 'compartilhar'
  const items: [string, string, string, () => Promise<void>][] = [
    ['midia', media.state === 'error' ? 'A mídia não baixou do PC' : p.media.length ? 'Mídia pro app' : 'Abrir o app', prep, async () => {
      if (media.state === 'error') return media.retry()
      if (media.state === 'loading') return
      const r = await share(pk.text, media.list)
      if (r.k === 'shared' || r.k === 'unsupported') mark('midia', 'legenda')
      if (r.k === 'unsupported') fail('este navegador não compartilha arquivos; a legenda foi copiada')
      if (r.k === 'failed') fail(r.why)
    }],
    ['legenda', 'Legenda', 'copiar', async () => void ((await copy(pk.caption)) && mark('legenda'))],
    ['tags', `Hashtags (${p.hashtags.length})`, 'copiar', async () => void ((await copy(pk.tags)) && mark('tags'))],
  ]
  if (pk.comment) items.push(['comentario', 'Comentário com o link', 'copiar', async () => void ((await copy(pk.comment)) && mark('comentario'))])
  const doneText: Record<string, string> = { midia: 'Mídia enviada pro app', legenda: 'Legenda copiada', tags: 'Hashtags copiadas', comentario: 'Comentário copiado' }
  return (
    <div className="flex min-h-full flex-col gap-4 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-28">
      <div className="flex items-center gap-2.5 pt-2">
        <button className="rnd" aria-label="Voltar" onClick={() => (history.length > 1 ? history.back() : go('/hoje'))}>
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-base">{p.title}</b>
          <small className="block text-xs font-bold text-text-muted">
            {net.name} · {p.time ?? 'sem hora'}
          </small>
        </div>
        <button className="pill ghost sm" onClick={edit}>
          Editar
        </button>
      </div>
      <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-3">
        {p.media[0] ? <Thumb post={p} name={p.media[0]} className="object-top" /> : <div className="grid size-full place-items-center text-sm font-bold text-text-faint">sem mídia</div>}
        {p.media.length > 1 && <span className="absolute top-2.5 right-2.5 grid h-6 place-items-center rounded-full bg-black/55 px-2.5 text-[11.5px] font-extrabold">1/{p.media.length}</span>}
      </div>
      <div className="flex flex-col gap-2">
        {items.map(([k, name, act, run], i) => {
          const ok = done.includes(k)
          const hot = just === k
          return (
            <button
              key={k}
              onClick={() => void run()}
              disabled={k === 'midia' && media.state === 'loading'}
              className="flex h-[54px] items-center gap-3 rounded-lg border bg-surface pr-2 pl-3.5 text-left disabled:opacity-60"
              style={{ borderColor: hot ? 'var(--color-ready)' : 'var(--color-border)', boxShadow: hot ? '0 0 0 4px color-mix(in srgb, var(--color-ready) 16%, transparent)' : undefined }}
            >
              <span className={`grid size-[26px] flex-none place-items-center rounded-full text-xs font-extrabold ${ok ? 'bg-ready text-on-accent' : 'bg-surface-3 text-text-muted'}`}>{ok ? <Check size={14} /> : i + 1}</span>
              <span className={`flex-1 text-sm font-bold ${ok && !hot ? 'text-text-muted line-through decoration-text-faint' : ''}`}>{ok ? doneText[k] : name}</span>
              <span className={`flex h-[38px] items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-extrabold ${ok && !hot ? 'text-text-faint' : hot ? 'bg-surface-3 text-ready' : 'bg-surface-3'}`}>
                {!ok && (k === 'midia' ? media.state === 'loading' ? <LoaderCircle size={14} className="animate-spin" /> : <Share size={14} /> : k === 'tags' ? <Hash size={14} /> : <Copy size={14} />)}
                {ok ? (hot ? `cole no ${net.name}` : 'refazer') : act}
              </span>
            </button>
          )
        })}
      </div>
      {p.status === 'posted' ? (
        <button className="btn g" onClick={() => void e.move('ready')}>
          Postado. Desfazer
        </button>
      ) : p.status === 'ready' ? (
        <button className="btn okf" onClick={() => void e.move('posted')}>
          <Check size={18} />
          Postei, marcar como postado
        </button>
      ) : (
        <button className="btn ok" onClick={() => void e.move('ready')}>
          <Check size={18} />
          Marcar como pronto
        </button>
      )}
    </div>
  )
}
