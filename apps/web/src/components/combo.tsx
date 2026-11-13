import { Check, CornerDownLeft } from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'
import { Find, Opt, Pop, useNav } from './pop.tsx'

export type Choice = { value: string; label: string; sub: string }

type Props = {
  value: string
  set: (v: string) => void
  options: Choice[]
  children: ReactElement
  title: string
  placeholder: string
  valid?: (v: string) => boolean
  hint?: string
}

export function Combo({ value, set, options, children, title, placeholder, valid = () => true, hint = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const typed = q.trim()

  const items = useMemo(() => {
    const t = typed.toLowerCase()
    const shown = t ? options.filter((o) => o.value.toLowerCase().includes(t) || o.label.toLowerCase().includes(t)) : options
    const own =
      typed && !options.some((o) => o.value === typed)
        ? [
            {
              value: typed,
              label: `Usar "${typed}"`,
              sub: valid(typed) ? 'outro modelo' : hint,
              own: true,
            },
          ]
        : []
    const cur = !typed && value && !options.some((o) => o.value === value) ? [{ value, label: value, sub: 'escolhido antes', own: false }] : []
    return [...own, ...cur, ...shown.map((o) => ({ ...o, own: false }))]
  }, [options, typed, value, valid, hint])

  const close = () => setOpen(false)
  const choose = (i: number) => {
    const it = items[i]
    if (!it || (it.own && !valid(it.value))) return
    close()
    if (it.value !== value) set(it.value)
  }
  const nav = useNav(items.length, choose, close)

  return (
    <Pop
      open={open}
      set={(o) => {
        setOpen(o)
        if (o) setQ('')
      }}
      title={title}
      trigger={children}
      width={340}
      keys={nav.keys}
      start={(el, mobile) => {
        if (!mobile) el.querySelector('input')?.focus()
        nav.jump(
          Math.max(
            0,
            items.findIndex((i) => i.value === value),
          ),
        )
      }}
    >
      <Find
        value={q}
        set={(v) => {
          setQ(v)
          nav.setAt(0)
        }}
        label={title}
        placeholder={placeholder}
        mono
        list={nav.list}
        active={nav.current}
      />
      <div id={nav.list} role="listbox" aria-label={title} className="opts">
        {items.map((it, i) => (
          <Opt key={`${it.own}${it.value}`} id={nav.id(i)} at={i === nav.at} on={!it.own && it.value === value} off={it.own && !valid(it.value)} pick={() => choose(i)} hover={() => nav.setAt(i)}>
            <span className="min-w-0 flex-1">
              <b className={`block truncate text-[13.5px] font-bold ${it.own ? 'font-mono font-medium' : ''}`}>{it.label}</b>
              <small className={`block truncate text-[11px] text-text-faint ${it.own ? 'font-semibold' : 'font-mono'}`}>{it.sub}</small>
            </span>
            {it.own ? <CornerDownLeft size={15} className="flex-none text-text-faint" /> : it.value === value && <Check size={16} strokeWidth={2.4} className="flex-none text-text" />}
          </Opt>
        ))}
      </div>
    </Pop>
  )
}
