import type { Ev, Item } from '@social-grid/core/chat.ts'
import { label } from '@social-grid/core/day.ts'
import { find } from '@social-grid/core/network/index.ts'
import { errors } from '@social-grid/core/network/net.ts'
import { check } from '@social-grid/core/post/ops.ts'
import { GERAL } from '@social-grid/core/post/post.ts'
import type { Session } from '@social-grid/core/chat.ts'
import { ArrowUp, BookOpen, Check, ChevronDown, Folder, History, Image as Picture, LoaderCircle, Sparkles, Square as Stop, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams, useSearch } from 'wouter'
import { Confirm } from '../components/confirm.tsx'
import { Md } from '../components/md.tsx'
import { Pick } from '../components/pick.tsx'
import { ProjectIcon, useName } from '../components/project.tsx'
import { Desk, useMobile } from '../components/shell.tsx'
import { color } from '../components/ui.tsx'
import { api } from '../lib/api.ts'
import { kind, short } from '../lib/fmt.ts'
import { useStore } from '../lib/store.ts'
import { useView } from './view.ts'
import { Week } from './week.tsx'

const MAX_PICS = 4

export const model = (m: string | null | undefined) => {
  if (!m) return 'Padrão'
  const s = m.replace(/^claude-/, '').replace(/\[.*\]$/, '').replace(/-(\d+)-(\d+)$/, ' $1.$2').replace(/-(\d+)$/, ' $1')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function Chat() {
  const mobile = useMobile()
  if (mobile) return <Panel full />
  return (
    <Desk cols="grid-cols-[1fr_470px]">
      <section className="card flex min-h-0 flex-col p-8">
        <Week alone />
      </section>
      <Panel />
    </Desk>
  )
}

function usePrefill() {
  const search = useSearch()
  const q = new URLSearchParams(search)
  const projects = useStore((s) => s.projects)
  const posts = useStore((s) => s.posts)
  const slot = q.get('slot')
  const rede = q.get('rede') ?? ''
  const formato = q.get('formato') ?? ''
  const post = q.get('post')
  const projeto = q.get('projeto') ?? (post ? posts[post]?.project : undefined) ?? projects.find((p) => p.id !== GERAL)?.id ?? GERAL
  const name = projects.find((p) => p.id === projeto)?.name ?? projeto
  let text = ''
  if (slot) {
    const [d, t] = slot.split('T')
    text = `Faz um post de ${find(rede)?.name ?? rede} (${formato}) do ${name} para o slot de ${label(d!)} às ${t}.`
  } else if (post && posts[post]) text = `Ajusta o post "${posts[post]!.title}" (id ${post}): `
  return { projeto, text, rede }
}

function Panel({ full = false }: { full?: boolean }) {
  const { id } = useParams<{ id?: string }>()
  const [, go] = useLocation()
  const pre = usePrefill()
  const config = useStore((s) => s.config)
  const chat = useStore((s) => (id ? s.chats[id] : undefined))
  const sessions = useStore((s) => s.sessions)
  const loadChat = useStore((s) => s.loadChat)
  const loadSessions = useStore((s) => s.loadSessions)
  const fail = useStore((s) => s.fail)
  const note = useStore((s) => s.note)
  const forget = useStore((s) => s.forget)
  const session = sessions.find((s) => s.id === id)
  const [project, setProject] = useState(pre.projeto)
  const [text, setText] = useState(pre.text)
  const [hist, setHist] = useState(false)
  const [del, setDel] = useState<Session | null>(null)
  const had = useRef<string | null>(null)
  const [sending, setSending] = useState(false)
  const [pics, setPics] = useState<string[]>([])
  const [upping, setUpping] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const pick = useRef<HTMLInputElement>(null)
  const pname = useName(session?.project ?? project)

  useEffect(() => {
    void loadSessions().catch(() => undefined)
    if (id) void loadChat(id).catch(() => fail('conversa não encontrada'))
  }, [id, loadChat, loadSessions, fail])

  useEffect(() => {
    if (!id) {
      setProject(pre.projeto)
      setText(pre.text)
    }
  }, [id, pre.projeto, pre.text])

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight })
  }, [chat?.items.length, chat?.stream])

  const running = chat?.state === 'running'
  const cur = session?.project ?? project

  useEffect(() => {
    if (id && chat) had.current = id
    else if (id && had.current === id && !chat) {
      had.current = null
      note('Esta conversa foi excluída')
      go(`/chat?projeto=${encodeURIComponent(cur)}`, { replace: true })
    }
  }, [id, chat, cur, go, note])

  const wipe = async () => {
    if (!del) return false
    try {
      await api.unchat(del.id)
      if (del.id === id) had.current = null
      forget(del.id)
      note('Conversa excluída')
      if (del.id === id) go(`/chat?projeto=${encodeURIComponent(del.project)}`, { replace: true })
      return true
    } catch (e) {
      fail(e instanceof Error ? e.message : 'não deu para excluir a conversa')
      return false
    }
  }

  const attach = async (list: File[]) => {
    const imgs = list.filter((f) => /^image\/(jpeg|png|webp|gif)$/.test(f.type)).slice(0, MAX_PICS - pics.length)
    if (list.length && !imgs.length) return fail('só imagem jpg, png, webp ou gif')
    setUpping((n) => n + imgs.length)
    for (const f of imgs) {
      try {
        const name = await api.picture(f)
        setPics((cur) => (cur.includes(name) || cur.length >= MAX_PICS ? cur : [...cur, name]))
      } catch (e) {
        fail(e instanceof Error ? e.message : 'a imagem não subiu')
      } finally {
        setUpping((n) => n - 1)
      }
    }
  }

  const send = async () => {
    const t = text.trim()
    if ((!t && !pics.length) || sending || upping) return
    setSending(true)
    try {
      if (id) await api.send(id, t, pics)
      else {
        const s = await api.chat(cur, t, pics)
        await loadSessions()
        go(`/chat/${s.id}`, { replace: true })
      }
      setText('')
      setPics([])
    } catch (e) {
      fail(e instanceof Error ? e.message : 'não deu para mandar')
    } finally {
      setSending(false)
    }
  }

  const skill = pre.rede ? `${pre.rede}-post-writer` : config?.skills[0]

  return (
    <aside className={`flex min-h-0 flex-col overflow-hidden ${full ? 'h-[calc(100dvh-64px-env(safe-area-inset-bottom))] bg-surface' : 'card'}`}>
      <div className={`relative flex items-center gap-2 border-b border-border px-5 py-4 ${full ? 'pt-[max(16px,env(safe-area-inset-top))]' : ''}`}>
        <h2 className="mr-auto flex items-center gap-2 text-base font-extrabold">
          <Sparkles size={18} className="text-ai" />
          Chat
        </h2>
        <Pick
          value={cur}
          geral
          title="Projeto da conversa"
          set={(p) => {
            setProject(p)
            if (id) go(`/chat?projeto=${encodeURIComponent(p)}`)
          }}
        >
          <button
            type="button"
            className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface-2 pr-2.5 pl-[5px] text-[12.5px] font-bold hover:border-border-strong data-[state=open]:border-border-strong"
            aria-label={`Projeto: ${pname}`}
          >
            <ProjectIcon id={cur} size={22} radius={7} className="!shadow-none" />
            <span className="max-w-[120px] truncate">{pname}</span>
            <ChevronDown size={14} className="text-text-faint" />
          </button>
        </Pick>
        <Link href="/config/skills" className="inline-flex h-8 items-center rounded-full border border-border bg-surface-2 px-3 text-[12.5px] font-bold text-text-muted">
          {model(config?.model)}
        </Link>
        <button className="grid size-8 place-items-center rounded-full text-text-muted hover:text-text" aria-label="Conversas" onClick={() => setHist(!hist)}>
          <History size={16} />
        </button>
        <Confirm
          title="Excluir esta conversa?"
          text="Ela some daqui e do histórico do Claude Code. Os posts criados nela continuam na agenda. Não dá pra desfazer."
          ok="Excluir conversa"
          busy="Excluindo…"
          run={wipe}
          open={del !== null}
          set={(o) => !o && setDel(null)}
        />
        {!full && (
          <Link href="/" className="grid size-8 place-items-center rounded-full text-text-muted hover:text-text" aria-label="Fechar">
            <X size={16} />
          </Link>
        )}
        {hist && (
          <div className="absolute top-full right-3 z-20 mt-2 flex max-h-[60vh] w-[320px] flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-surface-2 p-2 shadow-[var(--shadow-pop)]">
            <button className="rounded-md px-3 py-2 text-left text-[13px] font-extrabold hover:bg-surface-3" onClick={() => {
                setHist(false)
                go(`/chat?projeto=${encodeURIComponent(cur)}`)
              }}>
              + Conversa nova
            </button>
            {sessions.map((s) => (
              <div key={s.id} className={`group flex items-center rounded-md hover:bg-surface-3 ${s.id === id ? 'bg-surface-3' : ''}`}>
                <button className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-1 pl-3 text-left" onClick={() => {
                    setHist(false)
                    go(`/chat/${s.id}`)
                  }}>
                  <ProjectIcon id={s.project} size={22} radius={7} className="!shadow-none" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{s.title}</span>
                  {s.state === 'running' && <LoaderCircle size={14} className="animate-spin text-ai" />}
                </button>
                <button
                  className="mr-1 grid size-8 flex-none place-items-center rounded-full text-text-faint opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-surface-2 hover:text-danger focus-visible:opacity-100 pointer-coarse:opacity-100 [@media(hover:none)]:opacity-100"
                  aria-label={`Excluir conversa: ${s.title}`}
                  onClick={() => setDel(s)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {!sessions.length && <p className="px-3 py-2 text-[12.5px] font-semibold text-text-faint">Nenhuma conversa ainda.</p>}
          </div>
        )}
      </div>

      <div ref={box} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        {!id && !chat && <Intro />}
        <div className="mt-auto" />
        <Thread items={chat?.items ?? []} />
        {chat?.stream && (
          <div className="text-sm leading-[1.55]">
            <Md text={chat.stream} />
          </div>
        )}
        {running && !chat?.stream && (
          <div className="flex items-center gap-2 font-mono text-[11.5px] text-text-faint">
            <LoaderCircle size={13} className="animate-spin" />
            pensando…
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-5 pt-4 pb-5">
        <div className="flex gap-2">
          <span className="chip h-[26px] text-[11.5px]">
            <Folder size={14} />
            {pname}
          </span>
          {skill && (
            <span className="chip h-[26px] text-[11.5px]">
              <BookOpen size={14} />
              {skill}
            </span>
          )}
        </div>
        {(pics.length > 0 || upping > 0) && (
          <div className="flex gap-2">
            {pics.map((n) => (
              <span key={n} className="group relative size-14 flex-none overflow-hidden rounded-lg border border-border">
                <img src={api.image(n)} alt="" className="size-full object-cover" />
                <button
                  className="absolute top-1 right-1 hidden size-5 place-items-center rounded-full bg-black/65 group-hover:grid pointer-coarse:grid"
                  aria-label="Tirar imagem"
                  onClick={() => setPics((cur) => cur.filter((x) => x !== n))}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {upping > 0 && (
              <span className="grid size-14 flex-none place-items-center rounded-lg border border-dashed border-border-strong text-text-faint">
                <LoaderCircle size={16} className="animate-spin" />
              </span>
            )}
          </div>
        )}
        <div className="flex min-h-[52px] items-end gap-2 rounded-[26px] border border-border-strong bg-surface-2 py-1.5 pr-1.5 pl-[18px]">
          <textarea
            rows={1}
            className="max-h-40 min-h-10 flex-1 resize-none py-2.5 text-sm font-semibold placeholder:text-text-faint"
            placeholder={full ? 'Peça um post ou um ajuste' : 'Peça um post, um ajuste ou uma ideia'}
            value={text}
            maxLength={8000}
            onChange={(e) => {
              setText(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(160, e.target.scrollHeight)}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !full) {
                e.preventDefault()
                void send()
              }
            }}
            onPaste={(e) => {
              const files = [...e.clipboardData.files]
              if (files.length) {
                e.preventDefault()
                void attach(files)
              }
            }}
          />
          <button
            className="grid size-10 flex-none place-items-center rounded-full text-text-muted hover:text-text disabled:opacity-40"
            aria-label="Anexar imagem"
            title="Anexar imagem"
            disabled={pics.length >= MAX_PICS}
            onClick={() => pick.current?.click()}
          >
            <Picture size={18} />
          </button>
          <input
            ref={pick}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              void attach(files)
            }}
          />
          {running && id ? (
            <button className="grid size-10 flex-none place-items-center rounded-full bg-surface-3" aria-label="Parar" onClick={() => void api.stop(id)}>
              <Stop size={14} fill="currentColor" />
            </button>
          ) : null}
          <button
            className="grid size-10 flex-none place-items-center rounded-full bg-primary text-on-primary disabled:opacity-40"
            aria-label="Mandar"
            disabled={(!text.trim() && !pics.length) || sending || upping > 0}
            onClick={() => void send()}
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function Intro() {
  return (
    <div className="flex flex-col gap-2 text-[13.5px] leading-normal text-text-muted">
      <p>
        É o Claude Code, rodando no PC, com as suas skills de postagem e a pasta do projeto escolhido. Ele lê o código e o git, escreve o post e salva direto na agenda.
      </p>
      <p className="text-text-faint">Só leitura: ele não mexe nos arquivos do projeto.</p>
    </div>
  )
}

function Thread({ items }: { items: Item[] }) {
  const done = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const i of items) if (i.ev.k === 'done') m.set(i.ev.id, i.ev.ok)
    return m
  }, [items])
  const blocks: { user?: string; images?: string[]; parts: Ev[] }[] = []
  for (const { ev } of items) {
    if (ev.k === 'user') blocks.push({ user: ev.text, images: ev.images, parts: [] })
    else if (ev.k === 'text' || ev.k === 'tool' || ev.k === 'post' || ev.k === 'error') {
      const last = blocks.at(-1)
      if (!last || last.user !== undefined) blocks.push({ parts: [ev] })
      else last.parts.push(ev)
    }
  }
  return (
    <>
      {blocks.map((b, i) =>
        b.user !== undefined ? (
          <div key={i} className="flex max-w-[82%] flex-col items-end gap-1.5 self-end">
            {b.images && b.images.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {b.images.map((n) => (
                  <a key={n} href={api.image(n)} target="_blank" rel="noreferrer" className="block size-24 overflow-hidden rounded-xl border border-border">
                    <img src={api.image(n)} alt="" className="size-full object-cover" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                  </a>
                ))}
              </div>
            )}
            {b.user.trim() && <div className="rounded-[18px_18px_6px_18px] bg-surface-3 px-3.5 py-2.5 text-sm font-semibold whitespace-pre-wrap">{b.user}</div>}
          </div>
        ) : (
          <div key={i} className="text-sm leading-[1.55] text-text">
            {b.parts.map((ev, j) => {
              if (ev.k === 'tool') {
                const ok = done.get(ev.id)
                return (
                  <div key={j} className="mb-1.5 flex items-center gap-2 font-mono text-[11.5px] text-text-faint">
                    {ok === undefined ? <LoaderCircle size={13} className="animate-spin" /> : ok ? <Check size={13} strokeWidth={2.6} className="text-ready" /> : <X size={13} className="text-danger" />}
                    <span className="truncate">{ev.info}</span>
                  </div>
                )
              }
              if (ev.k === 'post') return <Made key={j} id={ev.id} />
              if (ev.k === 'error') return <p key={j} className="mt-1 text-[13px] font-bold text-danger">{ev.text}</p>
              if (ev.k !== 'text') return null
              return (
                <div key={j} className="mt-1 first:mt-0">
                  <Md text={ev.text} />
                </div>
              )
            })}
          </div>
        ),
      )}
    </>
  )
}

function Made({ id }: { id: string }) {
  const post = useStore((s) => s.posts[id])
  const refresh = useStore((s) => s.refresh)
  const set = useView((s) => s.set)
  const [, go] = useLocation()
  useEffect(() => {
    if (!post) void refresh(id)
  }, [post, id, refresh])
  if (!post) return null
  const errs = errors(check(post))
  const status = post.status === 'draft' ? 'rascunho' : post.status === 'ready' ? 'pronto' : 'postado'
  return (
    <div className="mt-2 flex flex-col gap-2.5 rounded-xl p-4 text-on-accent" style={{ background: color(post.network) }}>
      <div className="flex items-center gap-2.5">
        <ProjectIcon id={post.project} size={36} radius={10} />
        <div className="min-w-0">
          <b className="block text-[14.5px]">Post criado</b>
          <small className="text-[12.5px] font-bold opacity-75">
            {kind(post)} · {status}
          </small>
        </div>
        <span className="hr ml-auto text-on-accent">{post.date ? `${short(post.date)}${post.time ? ` · ${post.time}` : ''}` : 'sem data'}</span>
      </div>
      <span className="text-[12.5px] font-bold">{errs.length ? `Falta: ${errs.map((e) => e.text.toLowerCase()).join('; ')}.` : 'Tudo certo para ficar pronto.'}</span>
      <div className="flex gap-2">
        <Link className="pill black h-[34px] text-[12.5px]" href={`/post/${post.id}`}>
          Abrir post
        </Link>
        <button
          className="pill line h-[34px] text-[12.5px]"
          onClick={() => {
            if (post.date) set({ anchor: post.date, mode: 'semana' })
            go('/')
          }}
        >
          Ver na agenda
        </button>
      </div>
    </div>
  )
}
