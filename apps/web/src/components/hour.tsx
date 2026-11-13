import { isHm } from '@social-grid/core/day.ts'
import { Check, CornerDownLeft } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { Find, Opt, Pop, useNav } from './pop.tsx'

const ALL = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

function parse(s: string): string | null {
  const m = /^\s*(\d{1,2})\s*(?:[:h.]\s*)?(\d{2})?\s*h?\s*$/i.exec(s)
  if (!m) return null
  const t = `${m[1]!.padStart(2, '0')}:${m[2] ?? '00'}`
  return isHm(t) ? t : null
}

type Props = {
  value: string | null
  set: (t: string | null) => void
  children: ReactElement
  marks?: string[]
  color?: string
  mark?: string
  clear?: boolean
  title?: string
}

type Item = { t: string; own: boolean; slot: boolean }

export function Hour({ value, set, children, marks = [], color = 'var(--color-text-muted)', mark = 'slot da config', clear = false, title = 'Hora' }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const typed = parse(q)
  const digits = q.replace(/\D/g, '')

  const { groups, flat } = useMemo(() => {
    const slots = [...new Set(marks)].sort()
    const rest = [...new Set([...ALL, ...(value ? [value] : [])])].sort().filter((t) => !slots.includes(t))
    const fits = (t: string) => {
      if (!digits) return true
      const raw = t.replace(':', '')
      return raw.startsWith(digits) || raw.startsWith(digits.padStart(2, '0')) || (typed !== null && t === typed)
    }
    const own: Item[] = typed && ![...slots, ...rest].includes(typed) ? [{ t: typed, own: true, slot: false }] : []
    const groups: [string, Item[]][] = [
      ['', own],
      [slots.length ? mark : '', slots.filter(fits).map((t) => ({ t, own: false, slot: true }))],
      [slots.length ? 'Outros horários' : '', rest.filter(fits).map((t) => ({ t, own: false, slot: false }))],
    ]
    const shown = groups.filter(([, l]) => l.length)
    return { groups: shown, flat: shown.flatMap(([, l]) => l) }
  }, [marks, value, digits, typed, mark])

  const close = () => setOpen(false)
  const choose = (i: number) => {
    const it = flat[i]
    if (!it) return
    close()
    if (it.t !== value) set(it.t)
  }
  const nav = useNav(flat.length, choose, close)
  const { setAt } = nav

  useEffect(() => {
    if (q)
      setAt(
        Math.max(
          0,
          flat.findIndex((x) => x.t === typed),
        ),
      )
  }, [q])

  let n = 0
  return (
    <Pop
      open={open}
      set={(o) => {
        setOpen(o)
        if (o) setQ('')
      }}
      title={title}
      trigger={children}
      width={232}
      keys={nav.keys}
      start={(el, mobile) => {
        if (!mobile) el.querySelector('input')?.focus()
        const i = flat.findIndex((x) => x.t === value)
        nav.jump(
          i >= 0
            ? i
            : Math.max(
                0,
                flat.findIndex((x) => x.t >= '09:00' && !x.slot),
              ),
        )
      }}
    >
      <Find value={q} set={setQ} label="Digite a hora" placeholder="HH:MM" mono list={nav.list} active={nav.current} />
      <div id={nav.list} role="listbox" aria-label={title} className="opts">
        {groups.map(([name, items]) => (
          <div key={name || (items[0]?.own ? 'own' : 'all')} role="group" aria-label={name || undefined}>
            {name && (
              <div className="grp" aria-hidden>
                <h3>{name}</h3>
              </div>
            )}
            {items.map((it) => {
              const i = n++
              return (
                <Opt key={`${it.own}${it.t}`} id={nav.id(i)} at={i === nav.at} on={it.t === value} pick={() => choose(i)} hover={() => nav.setAt(i)}>
                  {it.slot ? <span className="dot" style={{ background: color }} /> : <span className="w-2 flex-none" />}
                  <span className={`flex-1 font-mono text-[13.5px] ${it.slot || it.own || it.t === value || i === nav.at ? 'font-medium text-text' : 'text-text-muted'}`}>{it.t}</span>
                  {it.own ? <CornerDownLeft size={15} className="text-text-faint" /> : it.t === value && <Check size={16} strokeWidth={2.4} className="text-text" />}
                </Opt>
              )
            })}
          </div>
        ))}
        {!flat.length && <p className="px-3 py-4 text-[13px] font-semibold text-text-faint">Use HH:MM, de 00:00 a 23:59.</p>}
      </div>
      {clear && (
        <div className="mt-2 flex border-t border-border px-1 pt-2">
          <button type="button" className="pill ghost sm w-full" onClick={() => (close(), value !== null && set(null))}>
            Sem hora
          </button>
        </div>
      )}
    </Pop>
  )
}
