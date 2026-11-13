import { add, days, monday, MONTHS, today, WEEK } from '@social-grid/core/day.ts'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { longDay } from '../lib/fmt.ts'
import { Pop } from './pop.tsx'

export type Mark = { color: string; full: boolean }

type Props = {
  value: string | null
  set: (d: string | null) => void
  children: ReactElement
  marks?: (from: string, to: string) => Record<string, Mark[]>
  legend?: string
  clear?: boolean
  title?: string
}

const month = (d: string) => `${d.slice(0, 7)}-01`

function shift(d: string, n: number) {
  const x = new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1 + n, 1)
  const first = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-01`
  const last = add(month(add(first, 40)), -1)
  const day = `${first.slice(0, 8)}${d.slice(8)}`
  return day > last ? last : day
}

export function Cal({ value, set, children, marks, legend, clear = true, title = 'Data' }: Props) {
  const [open, setOpen] = useState(false)
  const now = today(new Date())
  const [cur, setCur] = useState(value ?? now)
  const [view, setView] = useState(month(cur))
  const grid = useRef<HTMLDivElement>(null)
  const kb = useRef(false)

  const start = monday(view)
  const end = add(month(add(view, 40)), -1)
  const cells = days(start, add(monday(end), 6))
  const dots = useMemo(() => marks?.(start, cells.at(-1)!) ?? {}, [marks, start, cells.length])

  useEffect(() => {
    if (!kb.current) return
    kb.current = false
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${cur}"]`)?.focus()
  }, [cur, view])

  const go = (d: string) => {
    kb.current = true
    setCur(d)
    if (month(d) !== view) setView(month(d))
  }

  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key
    if (k === 'ArrowLeft') go(add(cur, -1))
    else if (k === 'ArrowRight') go(add(cur, 1))
    else if (k === 'ArrowUp') go(add(cur, -7))
    else if (k === 'ArrowDown') go(add(cur, 7))
    else if (k === 'Home') go(monday(cur))
    else if (k === 'End') go(add(monday(cur), 6))
    else if (k === 'PageUp') go(shift(cur, e.shiftKey ? -12 : -1))
    else if (k === 'PageDown') go(shift(cur, e.shiftKey ? 12 : 1))
    else return
    e.preventDefault()
  }

  const pick = (d: string | null) => {
    setOpen(false)
    if (d !== value) set(d)
  }

  const tab = view === month(cur) ? cur : view
  const name = MONTHS[Number(view.slice(5, 7)) - 1]!

  return (
    <Pop
      open={open}
      set={(o) => {
        if (o) {
          const d = value ?? now
          setCur(d)
          setView(month(d))
        }
        setOpen(o)
      }}
      title={title}
      trigger={children}
      width={316}
      start={(el) => el.querySelector<HTMLButtonElement>('[data-day][tabindex="0"]')?.focus()}
    >
      <div className="flex items-center gap-1 px-1.5 pt-1 pb-2">
        <b className="mr-auto text-[15px] font-bold tracking-[-0.01em] first-letter:uppercase" aria-live="polite">
          {name} <span className="text-text-faint">{view.slice(0, 4)}</span>
        </b>
        <button type="button" className="rnd size-8" aria-label="Mês anterior" onClick={() => setView(month(shift(view, -1)))}>
          <ChevronLeft size={16} />
        </button>
        <button type="button" className="rnd size-8" aria-label="Próximo mês" onClick={() => setView(month(shift(view, 1)))}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div ref={grid} role="grid" aria-label={`${name} ${view.slice(0, 4)}`} onKeyDown={keys}>
        <div role="row" className="grid grid-cols-7 pb-1 text-center text-[10.5px] font-bold tracking-[.06em] text-text-faint uppercase">
          {WEEK.map((w) => (
            <span key={w} role="columnheader" aria-label={w}>
              {w}
            </span>
          ))}
        </div>
        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <div key={r} role="row" className="grid grid-cols-7">
            {cells.slice(r * 7, r * 7 + 7).map((d) => {
              if (month(d) !== view) return <span key={d} role="gridcell" />
              const ms = d < now ? [] : (dots[d] ?? [])
              const cls = ['day', d === value ? 'on' : '', d === now ? 'now' : '', d < now && d !== value ? 'past' : ''].join(' ')
              return (
                <span key={d} role="gridcell" aria-selected={d === value}>
                  <button
                    type="button"
                    data-day={d}
                    tabIndex={d === tab ? 0 : -1}
                    className={cls}
                    aria-label={`${longDay(d)}${d === now ? ', hoje' : ''}${ms.length ? `, ${ms.some((m) => !m.full) ? 'slot livre' : 'slot ocupado'}` : ''}`}
                    onFocus={() => setCur(d)}
                    onClick={() => pick(d)}
                  >
                    {Number(d.slice(8))}
                    {ms.length > 0 && (
                      <i>
                        {ms.slice(0, 3).map((m, j) => (
                          <b key={j} className={m.full ? 'full' : ''} style={{ background: m.color, color: m.color }} />
                        ))}
                      </i>
                    )}
                  </button>
                </span>
              )
            })}
          </div>
        ))}
      </div>
      {legend && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pt-2 text-[11.5px] font-semibold text-text-faint">
          <span className="flex items-center gap-1.5">
            <i className="size-[6px] rounded-full bg-text-muted" />
            {legend} livre
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-[6px] rounded-full shadow-[inset_0_0_0_1px_var(--color-text-muted)]" />
            ocupado
          </span>
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 border-t border-border px-1 pt-2">
        {clear && (
          <button type="button" className="pill ghost sm" onClick={() => pick(null)}>
            Sem data
          </button>
        )}
        <span className="ml-auto truncate text-[12px] font-semibold text-text-muted">{value ? longDay(value) : 'sem data'}</span>
        <button type="button" className="pill white sm" onClick={() => pick(now)} disabled={value === now}>
          Hoje
        </button>
      </div>
    </Pop>
  )
}
