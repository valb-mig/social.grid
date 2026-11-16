import { Check, Copy, ExternalLink, Smartphone } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link as Go } from 'wouter'
import { api, type Link, type Todo } from '../lib/api.ts'
import { copy } from '../lib/share.ts'
import { useStore } from '../lib/store.ts'
import { Toggle } from './ui.tsx'

const Qr = lazy(() => import('./qr.tsx'))

export function useLink(every = 0) {
  const [link, set] = useState<Link | null>(null)
  const [busy, setBusy] = useState(false)
  const fail = useStore((s) => s.fail)
  const load = useCallback(() => api.link().then(set, () => set(null)), [])
  useEffect(() => {
    void load()
    if (!every) return
    const t = setInterval(() => void load(), every)
    return () => clearInterval(t)
  }, [load, every])
  const toggle = async (on: boolean) => {
    setBusy(true)
    try {
      set(await api.publish(on))
    } catch (e) {
      fail(e instanceof Error ? e.message : 'não deu para mudar o link')
      await load()
    } finally {
      setBusy(false)
    }
  }
  return { link, busy, toggle }
}

type Tone = 'ready' | 'draft' | 'danger' | 'muted'

export function state(l: Link): { tone: Tone; text: string } {
  if (l.tailscale === 'missing') return { tone: 'danger', text: 'Tailscale não instalado' }
  if (l.tailscale === 'stopped') return { tone: 'danger', text: 'Tailscale parado' }
  if (l.state === 'on') return { tone: 'ready', text: 'Publicado na tailnet' }
  if (l.state === 'busy') return { tone: 'danger', text: `Porta ${l.serve} ocupada` }
  if (!l.want) return { tone: 'muted', text: 'Publicação desligada' }
  return { tone: 'draft', text: 'Ainda não publicado' }
}

const TONES: Record<Tone, string> = { ready: 'var(--color-ready)', draft: 'var(--color-draft)', danger: 'var(--color-danger)', muted: 'var(--color-text-faint)' }

export function Dot({ tone }: { tone: Tone }) {
  const c = TONES[tone]
  return <span className="size-[8px] flex-none rounded-full" style={{ background: c, boxShadow: `0 0 0 3px color-mix(in srgb, ${c} 25%, transparent)` }} />
}

function Copier({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  const fail = useStore((s) => s.fail)
  const run = async () => {
    if (!(await copy(text))) return fail('não deu para copiar')
    setDone(true)
    setTimeout(() => setDone(false), 1600)
  }
  return (
    <button type="button" className="rnd size-8" title={label} aria-label={label} onClick={() => void run()}>
      {done ? <Check size={15} className="text-ready" /> : <Copy size={15} />}
    </button>
  )
}

export function Url({ url, sm = false }: { url: string; sm?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5">
      <code className={`min-w-0 flex-1 font-mono font-semibold break-all text-text ${sm ? 'text-[12px]' : 'text-[13px]'}`}>{url}</code>
      <Copier text={url} label="Copiar o link" />
    </div>
  )
}

export function Code({ cmd }: { cmd: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-surface-3 px-3 py-1">
      <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-text">{cmd}</code>
      <Copier text={cmd} label="Copiar o comando" />
    </div>
  )
}

function Step({ t }: { t: Todo }) {
  return (
    <li className="flex flex-col gap-2">
      <span className="text-[13.5px] font-semibold leading-normal text-text">{t.text}</span>
      {t.cmd && <Code cmd={t.cmd} />}
      {!!t.links?.length && (
        <span className="flex flex-wrap gap-2">
          {t.links.map((l) => (
            <a key={l.href} className="pill ghost sm" href={l.href} target="_blank" rel="noreferrer">
              {l.label}
              <ExternalLink size={13} />
            </a>
          ))}
        </span>
      )}
    </li>
  )
}

export function Todos({ list }: { list: Todo[] }) {
  if (!list.length) return null
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border-strong px-4 py-3">
      <b className="text-[12px] font-extrabold tracking-[0.06em] text-text-faint uppercase">O que falta</b>
      <ol className="flex flex-col gap-3">
        {list.map((t) => (
          <Step key={t.id} t={t} />
        ))}
      </ol>
    </div>
  )
}

export function Scan({ value, size }: { value: string; size: number }) {
  return (
    <div className="flex-none" style={{ width: size, height: size }}>
      <Suspense fallback={<div className="size-full rounded-lg bg-white" />}>
        <Qr value={value} className="block size-full" />
      </Suspense>
    </div>
  )
}

export function Access({ qr = true }: { qr?: boolean }) {
  const { link, busy, toggle } = useLink(20_000)
  if (!link) return <div className="rounded-xl border border-border bg-surface-2 px-5 py-4 text-[13.5px] font-semibold text-text-muted">Verificando o Tailscale…</div>
  const s = state(link)
  const live = link.state === 'on' && !!link.url
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-2 px-5 py-4">
      <div className="flex items-center gap-3">
        <Dot tone={s.tone} />
        <div className="min-w-0 flex-1">
          <b className="block text-sm">{s.text}</b>
          <small className="text-[12.5px] font-semibold text-text-muted">
            {link.local ? `Ao iniciar, o app publica sozinho a porta ${link.serve} da tailnet.` : 'Só o PC liga ou desliga a publicação.'}
          </small>
        </div>
        <Toggle on={link.want} set={(v) => void toggle(v)} label="Publicar na tailnet" disabled={busy || !link.local} />
      </div>
      {link.url && (
        <div className={`flex gap-5 ${qr ? 'items-start' : 'flex-col'}`}>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <b className="text-[12px] font-extrabold tracking-[0.06em] text-text-faint uppercase">Link do celular</b>
              <Url url={link.url} />
              {!live && <small className="text-[12.5px] font-semibold text-text-muted">O link só abre o app depois de publicado.</small>}
            </div>
            <Phones link={link} />
          </div>
          {qr && live && (
            <div className="flex flex-none flex-col items-center gap-2">
              <Scan value={link.url} size={184} />
              <small className="text-[12px] font-semibold text-text-faint">Aponte a câmera do celular</small>
            </div>
          )}
        </div>
      )}
      <Todos list={link.todo} />
      {link.local && link.want && link.state === 'off' && link.tailscale === 'running' && (
        <button type="button" className="pill white sm self-start" disabled={busy} onClick={() => void toggle(true)}>
          Publicar agora
        </button>
      )}
    </div>
  )
}

function Phones({ link }: { link: Link }) {
  if (!link.phones.length) return null
  return (
    <div className="flex flex-col gap-2">
      <b className="text-[12px] font-extrabold tracking-[0.06em] text-text-faint uppercase">Celulares na tailnet</b>
      <ul className="flex flex-col gap-1.5">
        {link.phones.map((p) => (
          <li key={p.name} className="flex items-center gap-2.5 text-[13.5px] font-semibold">
            <Smartphone size={15} className="flex-none text-text-muted" />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <small className="text-[12px] text-text-faint">{p.os}</small>
            <span className="flex w-[64px] items-center justify-end gap-1.5 text-[12px] text-text-muted">
              <Dot tone={p.online ? 'ready' : 'muted'} />
              {p.online ? 'online' : 'offline'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Open({ done }: { done: () => void }) {
  const { link, busy, toggle } = useLink()
  if (!link) return <p className="px-2 py-3 text-[13.5px] font-semibold text-text-muted">Verificando o Tailscale…</p>
  const s = state(link)
  const live = link.state === 'on' && !!link.url
  const why = link.todo.find((t) => t.id !== 'phone') ?? link.todo[0]
  return (
    <div className="flex flex-col gap-3 p-2">
      <div className="flex items-center gap-2.5">
        <Dot tone={s.tone} />
        <b className="text-sm">{s.text}</b>
      </div>
      {live && link.url ? (
        <>
          <div className="self-center">
            <Scan value={link.url} size={208} />
          </div>
          <Url url={link.url} sm />
          <small className="text-center text-[12px] font-semibold text-text-faint">Aponte a câmera do celular, com o Tailscale ligado</small>
        </>
      ) : (
        <>
          {why && <Step t={why} />}
          {link.local && link.state === 'off' && link.tailscale === 'running' && (
            <button type="button" className="pill white sm self-start" disabled={busy} onClick={() => void toggle(true)}>
              Publicar na tailnet
            </button>
          )}
        </>
      )}
      <Go href="/config/celular" className="text-[12.5px] font-bold text-text-muted hover:text-text" onClick={done}>
        Mais em Config, Celular
      </Go>
    </div>
  )
}
