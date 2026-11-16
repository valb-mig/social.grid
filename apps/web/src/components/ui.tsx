import type { Status } from '@social-grid/core/post/post.ts'
import type { ReactNode, SVGProps } from 'react'

const NAMES: Record<Status, string> = { draft: 'Rascunho', ready: 'Pronto', posted: 'Postado' }

export function St({ status, className = '' }: { status: Status; className?: string }) {
  return (
    <span className={`st ${status} ${className}`}>
      <span>{NAMES[status]}</span>
    </span>
  )
}

export const statusName = (s: Status) => NAMES[s]

export function Toggle({ on, set, label, disabled = false }: { on: boolean; set: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`tg ${on ? 'on' : ''}`} onClick={() => set(!on)} />
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`card ${className}`}>{children}</section>
}

export function Seg<T extends string>({ value, options, set }: { value: T; options: [T, string][]; set: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button key={v} type="button" className={v === value ? 'on' : ''} onClick={() => set(v)}>
          {l}
        </button>
      ))}
    </div>
  )
}

export function Logo({ className = 'size-9' }: { className?: string }) {
  return <img src="/logo.svg" alt="" className={className} />
}

export function Brand() {
  return (
    <div className="flex w-[260px] items-center gap-2.5 text-base font-extrabold tracking-[-0.01em]">
      <Logo />
      <b>
        social<span className="text-text-faint">.grid</span>
      </b>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border-strong p-4 text-[13px] font-semibold text-text-muted">{children}</p>
}

type Ic = SVGProps<SVGSVGElement> & { size?: number }

const svg = ({ size = 18, strokeWidth = 1.8, ...p }: Ic) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})

export function Ig(p: Ic) {
  return (
    <svg {...svg(p)}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5v.01" />
    </svg>
  )
}

export function Li(p: Ic) {
  return (
    <svg {...svg(p)}>
      <path d="M6 10v8M6 6v.01M10.5 18v-4.5a3.2 3.2 0 0 1 6.5 0V18M10.5 10v8" />
    </svg>
  )
}

export function NetIcon({ net, ...p }: Ic & { net: string }) {
  return net === 'linkedin' ? <Li {...p} /> : <Ig {...p} />
}

export const color = (net: string) => `var(--color-${net === 'linkedin' ? 'linkedin' : 'instagram'})`

export function Badge({ net, sm = false }: { net: string; sm?: boolean }) {
  return (
    <i className={`badge ${sm ? 'sm' : ''}`} style={{ background: color(net) }}>
      <NetIcon net={net} />
    </i>
  )
}

export function Square({ net, size = 34 }: { net: string; size?: number }) {
  return (
    <span className="grid flex-none place-items-center rounded-[10px] text-on-accent" style={{ width: size, height: size, background: color(net) }}>
      <NetIcon net={net} size={size / 2} strokeWidth={2.2} />
    </span>
  )
}
