import { Calendar, Clock, Folder, SlidersVertical, Sparkles } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'wouter'
import { useStore } from '../lib/store.ts'
import { Brand } from './ui.tsx'

const QUERY = '(max-width: 767px)'

export function useMobile() {
  const [m, set] = useState(() => matchMedia(QUERY).matches)
  useEffect(() => {
    const q = matchMedia(QUERY)
    const on = () => set(q.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return m
}

function Live() {
  const live = useStore((s) => s.live)
  const peers = useStore((s) => s.peers)
  const text = !live ? 'offline' : peers.length > 1 ? `${peers[0]} +${peers.length - 1}` : (peers[0] ?? 'só este PC')
  return (
    <span
      className="flex h-9 max-w-[170px] items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-[12.5px] font-bold text-text-muted"
      title={live ? (peers.length ? `Conectado: ${peers.join(', ')}` : 'Nenhum outro aparelho conectado') : 'Sem conexão com o servidor'}
    >
      <span
        className="size-[7px] flex-none rounded-full"
        style={{
          background: live ? 'var(--color-ready)' : 'var(--color-danger)',
          boxShadow: `0 0 0 3px color-mix(in srgb, ${live ? 'var(--color-ready)' : 'var(--color-danger)'} 25%, transparent)`,
        }}
      />
      <span className="truncate">{text}</span>
    </span>
  )
}

const NAV: [string, string, typeof Calendar][] = [
  ['/', 'Agenda', Calendar],
  ['/projetos', 'Projetos', Folder],
  ['/config', 'Config', SlidersVertical],
]

const active = (loc: string, href: string) => (href === '/' ? loc === '/' || loc.startsWith('/post') || loc === '/hoje' : loc.startsWith(href))

export function Top() {
  const [loc] = useLocation()
  return (
    <header className="hidden h-[72px] flex-none items-center gap-4 px-6 md:flex">
      <Link href="/">
        <Brand />
      </Link>
      <nav className="mx-auto flex gap-1 rounded-full border border-border bg-surface p-1">
        {NAV.map(([href, name, Icon]) => (
          <Link
            key={href}
            href={href}
            className={`flex h-9 items-center gap-2 rounded-full px-4 text-[13.5px] font-bold ${active(loc, href) ? 'bg-surface-3 text-text' : 'text-text-muted hover:text-text'}`}
          >
            <Icon size={16} />
            {name}
          </Link>
        ))}
      </nav>
      <div className="flex w-[260px] items-center justify-end gap-2">
        <Live />
        <Link href="/chat" className="pill ai">
          <Sparkles size={16} />
          Chat
        </Link>
      </div>
    </header>
  )
}

const TABS: [string, string, typeof Calendar, boolean][] = [
  ['/hoje', 'Hoje', Clock, false],
  ['/', 'Agenda', Calendar, false],
  ['/projetos', 'Projetos', Folder, false],
  ['/chat', 'Chat', Sparkles, true],
]

export function Tabs() {
  const [loc] = useLocation()
  const on = (href: string) => (href === '/' ? loc === '/' : loc.startsWith(href))
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(64px+env(safe-area-inset-bottom))] grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      {TABS.map(([href, name, Icon, ai]) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center justify-center gap-1 text-[11px] font-extrabold"
          style={{ color: on(href) ? (ai ? 'var(--color-ai)' : 'var(--color-text)') : ai ? 'color-mix(in srgb, var(--color-ai) 70%, transparent)' : 'var(--color-text-faint)' }}
        >
          <Icon size={20} />
          {name}
        </Link>
      ))}
    </nav>
  )
}

export function Toast() {
  const error = useStore((s) => s.error)
  const notice = useStore((s) => s.notice)
  const act = useStore((s) => s.act)
  const text = error || notice
  if (!text) return null
  const go = act && !error ? act : null
  return (
    <div
      role="status"
      className={`fixed top-[max(16px,env(safe-area-inset-top))] left-1/2 z-50 flex min-h-11 w-max max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-[22px] pl-5 text-[13.5px] font-extrabold text-on-accent shadow-[var(--shadow-pop)] ${error ? 'bg-danger' : 'bg-ready'} ${go ? 'py-1.5 pr-1.5' : 'py-2.5 pr-5'}`}
    >
      <span>{text}</span>
      {go && (
        <button
          type="button"
          className="pill line sm"
          onClick={() => {
            useStore.setState({ notice: '', act: null })
            void go.run()
          }}
        >
          {go.label}
        </button>
      )}
    </div>
  )
}

export function Desk({ children, cols }: { children: ReactNode; cols: string }) {
  return <div className={`grid h-full min-h-0 gap-6 px-6 pb-6 ${cols}`}>{children}</div>
}
