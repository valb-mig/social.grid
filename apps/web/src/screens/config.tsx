import { nets, rules } from '@social-grid/core/network/index.ts'
import { total, weekly, type Config, type Rule } from '@social-grid/core/plan/config.ts'
import { tags as clean } from '@social-grid/core/post/post.ts'
import { Bell, BookOpen, Calendar, Check, ChevronDown, Clock, FileText, Hash, Plus, Share, Smartphone, Sparkles, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'wouter'
import { Combo, type Choice } from '../components/combo.tsx'
import { Hour } from '../components/hour.tsx'
import { Access } from '../components/link.tsx'
import { Md } from '../components/md.tsx'
import { Pick } from '../components/pick.tsx'
import { useMobile } from '../components/shell.tsx'
import { color, NetIcon, Toggle } from '../components/ui.tsx'
import { api, type Doc, type Entry } from '../lib/api.ts'
import { disable, enable, status, type PushState } from '../lib/push.ts'
import { useStore } from '../lib/store.ts'
import { model } from './chat.tsx'

const DAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
const MODEL = /^[A-Za-z0-9.\[\]_:-]{1,80}$/
const MODELS: Choice[] = [
  { value: '', label: 'Padrão do Claude Code', sub: 'sem modelo fixo' },
  ...['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'].map((m) => ({ value: m, label: model(m), sub: m })),
]
const TIPS: Record<string, string> = { instagram: 'Skill sugere ter a qui, 12h ou 18h a 21h', linkedin: 'Skill sugere ter a qui, 8h a 10h' }

type Tab = 'redes' | 'frequencia' | 'hashtags' | 'skills' | 'celular'

function useConfig(): [Config | null, (fn: (c: Config) => Config) => void] {
  const config = useStore((s) => s.config)
  const set = useStore((s) => s.setConfig)
  return [config, (fn) => config && set(fn(structuredClone(config)))]
}

export function Settings() {
  const { tab = 'frequencia' } = useParams<{ tab?: Tab }>()
  const mobile = useMobile()
  const [config] = useConfig()
  const on = config ? Object.values(config.nets).filter((n) => n.on).length : 0
  const tabs: [Tab, string, typeof Calendar, string?][] = [
    ['redes', 'Redes', Share, String(on)],
    ['frequencia', 'Frequência', Calendar],
    ['hashtags', 'Hashtags', Hash],
    ['skills', 'Skills', BookOpen, config ? String(config.skills.length + config.agents.length) : undefined],
    ['celular', 'Celular', Smartphone],
  ]
  if (!config) return <div className="p-8 text-text-muted">Carregando…</div>
  const pane = { redes: <Redes />, frequencia: <Frequencia />, hashtags: <Hashtags />, skills: <Skills />, celular: <Celular /> }[tab] ?? <Frequencia />
  return (
    <div className={mobile ? 'flex flex-col gap-4 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-28' : 'grid h-full min-h-0 grid-cols-[240px_1fr] gap-6 px-6 pb-6'}>
      <nav className={mobile ? 'flex gap-2 overflow-x-auto scroll-none' : 'card flex flex-col gap-1 self-start p-4'}>
        {tabs.map(([k, l, Icon, n]) => (
          <Link
            key={k}
            href={`/config/${k}`}
            className={
              mobile
                ? `chip ${tab === k ? 'on' : ''}`
                : `flex h-[42px] items-center gap-2.5 rounded-md px-3.5 text-sm font-bold ${tab === k ? 'bg-surface-3 text-text' : 'text-text-muted hover:text-text'}`
            }
          >
            <Icon size={16} />
            {l}
            {n && !mobile && <span className="ml-auto text-[11.5px] text-text-faint">{n}</span>}
          </Link>
        ))}
      </nav>
      {pane}
    </div>
  )
}

function Pane({ title, sub, side, children }: { title: string; sub: string; side?: ReactNode; children: ReactNode }) {
  const mobile = useMobile()
  return (
    <section className={`flex min-h-0 flex-col gap-6 *:flex-none ${mobile ? '' : 'card overflow-y-auto p-8 scroll-none'}`}>
      <div className={`flex gap-4 ${mobile ? 'flex-col' : 'items-end'}`}>
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em]">{title}</h1>
          <p className="mt-1 text-[15px] text-text-muted">{sub}</p>
        </div>
        {side && <div className="flex items-center gap-3 text-[13px] font-bold text-text-muted md:ml-auto">{side}</div>}
      </div>
      {children}
    </section>
  )
}

function Head({ net, children }: { net: string; children?: ReactNode }) {
  const [config] = useConfig()
  const n = nets.find((x) => x.id === net)!
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3 text-[14.5px] font-extrabold text-on-accent" style={{ background: color(net) }}>
      <NetIcon net={net} size={18} strokeWidth={2.2} />
      {n.name}
      {config?.nets[net]?.handle && <small className="text-[12.5px] font-bold opacity-70">{config.nets[net]!.handle}</small>}
      {children}
    </div>
  )
}

function Frequencia() {
  const [config, edit] = useConfig()
  const mobile = useMobile()
  if (!config) return null
  const week = total(config)
  const rule = (net: string, format: string): Rule => config.rules.find((r) => r.net === net && r.format === format) ?? { net, format, days: [], times: [], on: false }
  const put = (r: Rule) =>
    edit((c) => {
      const i = c.rules.findIndex((x) => x.net === r.net && x.format === r.format)
      const next = { ...r, days: [...new Set(r.days)].sort(), times: [...new Set(r.times)].sort() }
      if (i >= 0) c.rules[i] = next
      else c.rules.push(next)
      return c
    })
  return (
    <Pane
      title="Frequência"
      sub="Cada linha vira slots na agenda. O que não tiver post aparece tracejado."
      side={
        <>
          {week} {week === 1 ? 'post' : 'posts'} por semana · ~{Math.round(week * 4.3)} no mês
        </>
      }
    >
      {nets.map((n) => (
        <div key={n.id} className={`overflow-hidden rounded-xl border border-border bg-surface-2 ${config.nets[n.id]?.on ? '' : 'opacity-60'}`}>
          <Head net={n.id}>
            <span className="ml-auto flex items-center gap-1.5 text-xs font-bold opacity-80">
              <Sparkles size={14} />
              {TIPS[n.id]}
            </span>
          </Head>
          {rules(n.id).map((f) => {
            const r = rule(n.id, f.id)
            const count = weekly({ ...r, on: true })
            return (
              <div
                key={f.id}
                className={`grid items-center gap-4 border-t border-border px-5 py-4 first-of-type:border-t-0 ${mobile ? 'grid-cols-[1fr_auto]' : 'grid-cols-[180px_150px_290px_1fr_40px]'} ${r.on ? '' : 'opacity-45'}`}
              >
                <div>
                  <b className="block text-[14.5px]">{f.name}</b>
                  <small className="text-xs font-semibold text-text-faint">{f.hint}</small>
                </div>
                {mobile && <Toggle on={r.on} set={(on) => put({ ...r, on })} label={`${f.name} ligado`} />}
                <div className="flex h-9 w-max items-center rounded-full border border-border-strong">
                  <button
                    className="grid size-[34px] place-items-center font-bold text-text-muted"
                    aria-label="Menos um dia"
                    onClick={() => put({ ...r, days: r.days.slice(0, -1) })}
                  >
                    −
                  </button>
                  <b className="min-w-[22px] text-center text-[15px]">{count}</b>
                  <button
                    className="grid size-[34px] place-items-center font-bold text-text-muted"
                    aria-label="Mais um dia"
                    onClick={() => {
                      const free = [0, 1, 2, 3, 4, 5, 6].find((d) => !r.days.includes(d))
                      if (free !== undefined) put({ ...r, on: true, days: [...r.days, free], times: r.times.length ? r.times : ['12:00'] })
                    }}
                  >
                    +
                  </button>
                  <small className="pr-1.5 text-xs font-bold text-text-faint">/sem</small>
                </div>
                <div className={`flex gap-1.5 ${mobile ? 'col-span-2' : ''}`}>
                  {DAYS.map((d, i) => {
                    const on = r.days.includes(i)
                    return (
                      <button
                        key={i}
                        className="grid size-[34px] place-items-center rounded-full text-xs font-extrabold"
                        style={on ? { background: color(n.id), color: 'var(--color-on-accent)' } : { background: 'var(--color-surface-3)', color: 'var(--color-text-faint)' }}
                        onClick={() => put({ ...r, days: on ? r.days.filter((x) => x !== i) : [...r.days, i] })}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
                <Times times={r.times} set={(times) => put({ ...r, times })} />
                {!mobile && <Toggle on={r.on} set={(on) => put({ ...r, on })} label={`${f.name} ligado`} />}
              </div>
            )
          })}
        </div>
      ))}
      <Alerts />
    </Pane>
  )
}

function Times({ times, set }: { times: string[]; set: (t: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {times.map((t) => (
        <button
          key={t}
          className="group flex h-[34px] items-center gap-1 rounded-md border border-border-strong bg-surface-3 px-3 font-mono text-[13px]"
          title="Tirar horário"
          onClick={() => set(times.filter((x) => x !== t))}
        >
          {t}
          <X size={12} className="hidden text-text-faint group-hover:block pointer-coarse:block" />
        </button>
      ))}
      {times.length < 8 && (
        <Hour value={null} set={(t) => t && !times.includes(t) && set([...times, t])} title="Novo horário">
          <button
            type="button"
            className="flex h-[34px] items-center rounded-md border border-dashed border-border-strong px-3 text-[12.5px] font-bold text-text-faint hover:text-text-muted data-[state=open]:text-text-muted"
          >
            + horário
          </button>
        </Hour>
      )}
    </div>
  )
}

function Alerts() {
  const [config, edit] = useConfig()
  if (!config) return null
  const p = config.push
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-surface-2 px-5 py-4">
        <Bell size={18} className="flex-none text-text-muted" />
        <div className="flex-1">
          <b className="block text-sm">Avisar no celular</b>
          <small className="text-[12.5px] font-semibold text-text-muted">
            <Minutes value={p.before} set={(n) => edit((c) => ((c.push.before = n), c))} /> min antes de cada post pronto
          </small>
        </div>
        <Toggle on={p.ready} set={(v) => edit((c) => ((c.push.ready = v), c))} label="Avisar antes" />
      </div>
      <div className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-surface-2 px-5 py-4">
        <Clock size={18} className="flex-none text-text-muted" />
        <div className="flex-1">
          <b className="block text-sm">Rascunho no dia</b>
          <small className="text-[12.5px] font-semibold text-text-muted">
            avisar às{' '}
            <Hour value={p.at} set={(t) => t && edit((c) => ((c.push.at = t), c))} title="Aviso de rascunho">
              <button type="button" className="rounded-sm bg-surface-3 px-1.5 font-mono text-text hover:bg-border-strong" aria-label={`Hora do aviso: ${p.at}`}>
                {p.at}
              </button>
            </Hour>
            , ou antes se o post for mais cedo
          </small>
        </div>
        <Toggle on={p.draft} set={(v) => edit((c) => ((c.push.draft = v), c))} label="Avisar rascunho" />
      </div>
    </div>
  )
}

function Minutes({ value, set }: { value: number; set: (n: number) => void }) {
  const [text, setText] = useState(String(value))
  const fail = useStore((s) => s.fail)
  useEffect(() => setText(String(value)), [value])
  const save = () => {
    const n = Number(text)
    if (!/^\d{1,3}$/.test(text) || n < 1 || n > 240) {
      fail('Aviso antes do post: use de 1 a 240 minutos')
      setText(String(value))
      return
    }
    if (n !== value) set(n)
  }
  return (
    <input
      inputMode="numeric"
      maxLength={3}
      aria-label="Minutos antes"
      className="w-10 rounded-sm bg-surface-3 text-center font-mono"
      value={text}
      onChange={(e) => setText(e.target.value.replace(/\D/g, ''))}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

function Redes() {
  const [config, edit] = useConfig()
  const root = useStore((s) => s.root)
  const [dir, setDir] = useState(config?.root ?? '')
  if (!config) return null
  return (
    <Pane title="Redes" sub="Onde você posta. Rede desligada some da agenda e dos slots.">
      {nets.map((n) => {
        const c = config.nets[n.id]!
        return (
          <div key={n.id} className="overflow-hidden rounded-xl border border-border bg-surface-2">
            <Head net={n.id}>
              <span className="ml-auto">
                <Toggle on={c.on} set={(on) => edit((x) => ((x.nets[n.id]!.on = on), x))} label={`${n.name} ligado`} />
              </span>
            </Head>
            <label className="flex items-center gap-3 px-5 py-4">
              <span className="w-24 text-[13px] font-bold text-text-muted">Perfil</span>
              <input className="field" placeholder={n.id === 'instagram' ? '@seu.perfil' : 'in/seu-perfil'} value={c.handle} maxLength={80} onChange={(e) => edit((x) => ((x.nets[n.id]!.handle = e.target.value), x))} />
            </label>
          </div>
        )
      })}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-2 px-5 py-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-text-muted">Pasta de projetos (cada repositório git de primeiro nível vira um projeto)</span>
          <input
            className="field font-mono"
            placeholder={root}
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            onBlur={() => edit((x) => ((x.root = dir.trim() || null), x))}
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-text-muted">Modelo do chat (agora: {model(config.model)})</span>
          <Combo
            value={config.model ?? ''}
            set={(v) => edit((x) => ((x.model = v || null), x))}
            options={MODELS}
            title="Modelo do chat"
            placeholder="buscar ou digitar outro"
            valid={(v) => MODEL.test(v)}
            hint="use letras, números e . _ : - [ ]"
          >
            <button type="button" className="field flex items-center gap-2 text-left hover:border-border-strong data-[state=open]:border-border-strong" aria-label={`Modelo do chat: ${model(config.model)}`}>
              <span className={`flex-1 truncate ${config.model ? 'font-mono' : 'text-text-muted'}`}>{config.model ?? 'Padrão do Claude Code'}</span>
              <ChevronDown size={16} className="flex-none text-text-faint" />
            </button>
          </Combo>
        </div>
      </div>
    </Pane>
  )
}

function Chips({ list, set }: { list: string[]; set: (l: string[]) => void }) {
  const [text, setText] = useState('')
  const add = () => {
    if (text.trim()) set(clean([...list, ...text.split(/[\s,]+/)]))
    setText('')
  }
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((t) => (
        <span key={t} className="tag">
          #{t}
          <button aria-label={`Tirar #${t}`} onClick={() => set(list.filter((x) => x !== t))}>
            <X size={13} className="text-text-faint hover:text-text" />
          </button>
        </span>
      ))}
      <input className="tag add w-36 text-text" placeholder="+ hashtag" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} onBlur={add} />
    </div>
  )
}

function Hashtags() {
  const [config, edit] = useConfig()
  const projects = useStore((s) => s.projects)
  if (!config) return null
  const custom = Object.keys(config.tags.projects)
  return (
    <Pane title="Hashtags" sub="Entram sozinhas em todo post novo, pela rede e pelo projeto. Dá para tirar no post.">
      {nets.map((n) => (
        <div key={n.id} className="overflow-hidden rounded-xl border border-border bg-surface-2">
          <Head net={n.id} />
          <div className="px-5 py-4">
            <Chips list={config.tags.nets[n.id] ?? []} set={(l) => edit((c) => ((c.tags.nets[n.id] = l), c))} />
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-2 px-5 py-4">
        <div className="flex items-center gap-3">
          <b className="text-sm">Por projeto</b>
          <Pick value="" set={(id) => edit((c) => ((c.tags.projects[id] = c.tags.projects[id] ?? []), c))} skip={custom} geral title="Adicionar projeto">
            <button type="button" className="pill ghost sm ml-auto data-[state=open]:border-text-faint">
              <Plus size={14} />
              Adicionar projeto
            </button>
          </Pick>
        </div>
        {custom.map((id) => (
          <div key={id} className="flex flex-col gap-2 border-t border-border pt-3">
            <div className="flex items-center gap-2 text-[13px] font-extrabold">
              {projects.find((p) => p.id === id)?.name ?? id}
              <button
                className="ml-auto text-xs font-bold text-text-faint hover:text-text-muted"
                onClick={() =>
                  edit((c) => {
                    delete c.tags.projects[id]
                    return c
                  })
                }
              >
                remover
              </button>
            </div>
            <Chips list={config.tags.projects[id] ?? []} set={(l) => edit((c) => ((c.tags.projects[id] = l), c))} />
          </div>
        ))}
      </div>
    </Pane>
  )
}

function Skills() {
  const [config, edit] = useConfig()
  const mobile = useMobile()
  const [list, setList] = useState<Entry[]>([])
  const [sel, setSel] = useState<{ kind: 'skill' | 'agent'; name: string; file: string } | null>(null)
  const [doc, setDoc] = useState<Doc | null>(null)
  const [body, setBody] = useState('')
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState<'ok' | 'saving' | 'error'>('ok')
  const [add, setAdd] = useState('')
  const fail = useStore((s) => s.fail)
  const names = `${config?.skills.join(',')}|${config?.agents.join(',')}`

  useEffect(() => {
    void api.skills().then((l) => {
      setList(l)
      const first = l.find((e) => !e.missing)
      setSel((cur) => cur ?? (first ? { kind: first.kind, name: first.name, file: first.files[0]! } : null))
    }, () => undefined)
  }, [names])

  useEffect(() => {
    if (!sel) return
    setDoc(null)
    setEditing(false)
    void api.skill(sel.kind, sel.name, sel.file).then(
      (d) => {
        setDoc(d)
        setBody(d.body)
      },
      (e) => fail(e instanceof Error ? e.message : 'não deu para abrir'),
    )
  }, [sel, fail])

  const save = async () => {
    if (!sel || !doc || body === doc.body) return
    setSaved('saving')
    try {
      setDoc(await api.write(sel.kind, sel.name, sel.file, body))
      setSaved('ok')
    } catch (e) {
      setSaved('error')
      fail(e instanceof Error ? e.message : 'não deu para salvar')
    }
  }

  if (!config) return null
  const dotOf = (e: Entry) => (e.kind === 'agent' ? 'var(--color-ai)' : e.name.includes('linkedin') ? 'var(--color-linkedin)' : e.name.includes('instagram') ? 'var(--color-instagram)' : 'var(--color-text-faint)')

  return (
    <section className={`min-h-0 ${mobile ? 'flex flex-col gap-4' : 'card grid grid-cols-[300px_1fr] overflow-hidden p-0'}`}>
      <div className={`flex min-h-0 flex-col gap-4 overflow-y-auto scroll-none ${mobile ? '' : 'border-r border-border p-6'}`}>
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">Skills</h1>
          <p className="mt-0.5 text-[13.5px] text-text-muted">De ~/.claude/skills e ~/.claude/agents. O chat daqui e o Claude Code do terminal usam as mesmas.</p>
        </div>
        {list.map((e) => (
          <div key={`${e.kind}${e.name}`} className="flex flex-col gap-2">
            <div
              role="button"
              tabIndex={0}
              className="flex cursor-pointer flex-col gap-1.5 rounded-lg border bg-surface-2 px-4 py-3 text-left"
              style={{ borderColor: sel?.name === e.name && sel.kind === e.kind ? 'var(--color-primary)' : 'var(--color-border)' }}
              onClick={() => !e.missing && setSel({ kind: e.kind, name: e.name, file: e.files[0]! })}
              onKeyDown={(ev) => ev.key === 'Enter' && !e.missing && setSel({ kind: e.kind, name: e.name, file: e.files[0]! })}
            >
              <span className="flex items-center gap-2">
                <span className="size-[9px] flex-none rounded-full" style={{ background: dotOf(e) }} />
                <b className="truncate text-sm">{e.name}</b>
                <button
                  className="ml-auto text-text-faint hover:text-text"
                  aria-label="Tirar da lista"
                  onClick={(ev) => {
                    ev.stopPropagation()
                    edit((c) => {
                      if (e.kind === 'skill') c.skills = c.skills.filter((x) => x !== e.name)
                      else c.agents = c.agents.filter((x) => x !== e.name)
                      return c
                    })
                  }}
                >
                  <X size={14} />
                </button>
              </span>
              <small className="line-clamp-2 text-xs font-semibold text-text-faint">{e.missing ? 'não encontrado nesta máquina' : `${e.kind === 'agent' ? 'agente · ' : ''}${e.about}`}</small>
            </div>
            {sel?.name === e.name && sel.kind === e.kind && e.files.length > 1 && (
              <div className="flex flex-col gap-0.5 pl-2">
                {e.files.map((f) => (
                  <button
                    key={f}
                    className={`flex h-8 items-center gap-2 rounded-sm px-2.5 text-left font-mono text-[12.5px] ${sel.file === f ? 'bg-surface-3 text-text' : 'text-text-muted'}`}
                    onClick={() => setSel({ ...sel, file: f })}
                  >
                    <FileText size={14} />
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="flex gap-2">
          <input className="field" placeholder="nome da skill ou agente" value={add} onChange={(e) => setAdd(e.target.value.toLowerCase())} />
        </div>
        <div className="flex gap-2">
          <button className="pill ghost sm flex-1" disabled={!/^[a-z0-9][a-z0-9-]{0,63}$/.test(add)} onClick={() => (edit((c) => ((c.skills = [...new Set([...c.skills, add])]), c)), setAdd(''))}>
            + skill
          </button>
          <button className="pill ghost sm flex-1" disabled={!/^[a-z0-9][a-z0-9-]{0,63}$/.test(add)} onClick={() => (edit((c) => ((c.agents = [...new Set([...c.agents, add])]), c)), setAdd(''))}>
            + agente
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-col">
        {doc ? (
          <>
            <div className="flex items-center gap-3 border-b border-border px-6 py-4">
              <span className="truncate font-mono text-[12.5px] text-text-muted">
                {doc.path.slice(0, doc.path.length - doc.file.length)}
                <b className="font-medium text-text">{doc.file}</b>
              </span>
              <span className={`ml-auto flex flex-none items-center gap-1.5 text-[12.5px] font-bold ${saved === 'error' ? 'text-danger' : saved === 'saving' ? 'text-text-muted' : 'text-ready'}`}>
                {saved === 'ok' && <Check size={14} />}
                {saved === 'saving' ? 'Salvando…' : saved === 'error' ? 'Não salvou' : body === doc.body ? 'Salvo' : 'Editando'}
              </span>
            </div>
            {doc.front && (
              <details className="border-b border-border px-8 py-2 text-xs text-text-faint">
                <summary className="cursor-pointer font-bold">frontmatter (só leitura)</summary>
                <pre className="mt-2 font-mono whitespace-pre-wrap">{doc.front}</pre>
              </details>
            )}
            {editing ? (
              <textarea
                autoFocus
                className={`min-h-[360px] flex-1 resize-none px-8 py-6 font-mono text-[13.5px] leading-[1.65] text-text ${mobile ? '' : ''}`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onBlur={() => {
                  setEditing(false)
                  void save()
                }}
              />
            ) : (
              <div className="min-h-[200px] flex-1 cursor-text overflow-y-auto px-8 py-6 text-[14.5px] leading-[1.65] text-text-muted" onClick={() => setEditing(true)}>
                <Md text={body} big />
              </div>
            )}
            <div className="m-6 mt-0 flex items-center gap-2 rounded-lg px-4 py-3 text-[13px] font-bold text-ai" style={{ background: 'color-mix(in srgb, var(--color-ai) 12%, transparent)' }}>
              <Sparkles size={16} />
              Mudou a skill? Vale já na próxima conversa do chat.
            </div>
          </>
        ) : (
          <p className="p-8 text-[13.5px] font-semibold text-text-faint">Escolha uma skill para ver e editar.</p>
        )}
      </div>
    </section>
  )
}

function Celular() {
  const mobile = useMobile()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const fail = useStore((s) => s.fail)
  useEffect(() => {
    void status().then(setState)
  }, [])
  const run = async (fn: () => Promise<PushState>) => {
    setBusy(true)
    try {
      setState(await fn())
    } catch (e) {
      fail(e instanceof Error ? e.message : 'não deu')
    } finally {
      setBusy(false)
    }
  }
  const text: Record<PushState, string> = {
    unsupported: 'Este navegador não recebe avisos. No celular, instale o app pela tela inicial (pelo endereço https da tailnet).',
    denied: 'Os avisos estão bloqueados nas permissões do navegador para este site.',
    off: 'Este aparelho ainda não recebe avisos.',
    on: 'Este aparelho recebe os avisos.',
  }
  return (
    <Pane title="Celular" sub="O app se publica sozinho na tailnet. No celular, ele vira app e recebe os avisos pelo Web Push.">
      <Access qr={!mobile} />
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-2 px-5 py-4">
        <div className="flex items-center gap-3">
          <Bell size={18} className="text-text-muted" />
          <b className="flex-1 text-sm">{state ? text[state] : 'Verificando…'}</b>
        </div>
        <div className="flex flex-wrap gap-2">
          {state === 'on' ? (
            <>
              <button className="pill white sm" disabled={busy} onClick={() => void api.test().catch((e) => fail(e instanceof Error ? e.message : 'falhou'))}>
                Mandar aviso de teste
              </button>
              <button className="pill ghost sm" disabled={busy} onClick={() => void run(disable)}>
                Parar avisos aqui
              </button>
            </>
          ) : (
            <button className="pill white sm" disabled={busy || state === 'unsupported' || state === 'denied'} onClick={() => void run(enable)}>
              Inscrever este aparelho
            </button>
          )}
        </div>
      </div>
      <Alerts />
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border-strong px-5 py-4 text-[13.5px] leading-normal text-text-muted">
        <b className="text-text">Depois de publicado</b>
        <p>1. No celular, com o Tailscale ligado, aponte a câmera para o QR (ou abra o link) e escolha "Instalar app" ou "Adicionar à tela inicial".</p>
        <p>2. Abra o app instalado e toque em "Inscrever este aparelho".</p>
      </div>
    </Pane>
  )
}
