import { Search } from 'lucide-react'
import { Dialog, Popover } from 'radix-ui'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import { useMobile } from './shell.tsx'

type Props = {
  open: boolean
  set: (open: boolean) => void
  title: string
  trigger: ReactElement
  children: ReactNode
  width?: number
  align?: 'start' | 'center' | 'end'
  start?: (root: HTMLElement, mobile: boolean) => void
  keys?: (e: KeyboardEvent<HTMLDivElement>) => void
}

export function Pop({ open, set, title, trigger, children, width = 320, align = 'start', start, keys }: Props) {
  const mobile = useMobile()
  const root = useRef<HTMLDivElement>(null)
  const focus = (e: Event) => {
    e.preventDefault()
    const el = root.current
    if (!el) return
    el.focus({ preventScroll: true })
    start?.(el, mobile)
  }
  if (mobile) {
    return (
      <Dialog.Root open={open} onOpenChange={set}>
        <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="veil" />
          <Dialog.Content ref={root} className="sheet" aria-describedby={undefined} onOpenAutoFocus={focus} onKeyDown={keys}>
            <Dialog.Title className="mb-3 px-1 text-[17px] font-bold tracking-[-0.01em]">{title}</Dialog.Title>
            {children}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }
  return (
    <Popover.Root open={open} onOpenChange={set}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content ref={root} className="pop" style={{ width }} align={align} sideOffset={8} collisionPadding={16} aria-label={title} onOpenAutoFocus={focus} onKeyDown={keys}>
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function Find({
  value,
  set,
  label,
  placeholder,
  mono = false,
  list,
  active,
}: {
  value: string
  set: (v: string) => void
  label: string
  placeholder: string
  mono?: boolean
  list: string
  active?: string
}) {
  return (
    <label className="find">
      <Search size={16} className="flex-none" />
      <input
        role="combobox"
        aria-label={label}
        aria-expanded
        aria-controls={list}
        aria-autocomplete="list"
        aria-activedescendant={active}
        className={mono ? 'font-mono' : ''}
        placeholder={placeholder}
        value={value}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => set(e.target.value)}
      />
    </label>
  )
}

export function Opt({ id, at, on, off = false, pick, hover, children }: { id: string; at: boolean; on: boolean; off?: boolean; pick: () => void; hover: () => void; children: ReactNode }) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={on}
      aria-disabled={off || undefined}
      data-at={at || undefined}
      className="opt"
      onMouseMove={() => !at && hover()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => !off && pick()}
    >
      {children}
    </div>
  )
}

export function useNav(count: number, pick: (i: number) => void, close: () => void) {
  const [at, setAt] = useState(0)
  const ids = useId()
  const id = (i: number) => `${ids}o${i}`
  const list = `${ids}l`
  const kb = useRef(false)

  useEffect(() => {
    if (at >= count) setAt(Math.max(0, count - 1))
  }, [at, count])

  useEffect(() => {
    if (!kb.current) return
    kb.current = false
    document.getElementById(id(at))?.scrollIntoView({ block: 'nearest' })
  })

  const move = (n: number) => {
    if (!count) return
    kb.current = true
    setAt((cur) => Math.min(count - 1, Math.max(0, cur + n)))
  }

  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key
    if (k === 'ArrowDown') move(1)
    else if (k === 'ArrowUp') move(-1)
    else if (k === 'PageDown') move(8)
    else if (k === 'PageUp') move(-8)
    else if ((k === 'Home' || k === 'End') && !(e.target instanceof HTMLInputElement && e.target.value)) move(k === 'Home' ? -count : count)
    else if (k === 'Enter') {
      if (count) pick(Math.min(at, count - 1))
    } else if (k === 'Tab') close()
    else return
    e.preventDefault()
  }

  const jump = (i: number) => {
    kb.current = false
    setAt(i)
    requestAnimationFrame(() => document.getElementById(id(i))?.scrollIntoView({ block: 'center' }))
  }

  return {
    at,
    setAt,
    keys,
    id,
    list,
    jump,
    current: count ? id(Math.min(at, count - 1)) : undefined,
  }
}
