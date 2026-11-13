import type { ReactNode } from 'react'

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s)<>"']+)/g

function safe(url: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}

function inline(text: string, key: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const k = `${key}-${i}`
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <b key={k} className="font-extrabold text-text">{part.slice(2, -2)}</b>
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={k} className="rounded-md bg-surface-3 px-1.5 py-px font-mono text-[13px] text-text">{part.slice(1, -1)}</code>
    if (/^https?:\/\//.test(part) && safe(part)) {
      return (
        <a key={k} href={part} target="_blank" rel="noreferrer noopener" className="underline decoration-text-faint underline-offset-2">
          {part}
        </a>
      )
    }
    return part
  })
}

export function Md({ text, big = false }: { text: string; big?: boolean }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: ReactNode[] = []
  let code: string[] | null = null
  let list: string[] = []
  let para: string[] = []

  const flush = (i: number) => {
    if (list.length) {
      out.push(
        <ul key={`u${i}`} className="mt-2 list-disc pl-5 first:mt-0">
          {list.map((t, j) => (
            <li key={j}>{inline(t, `l${i}-${j}`)}</li>
          ))}
        </ul>,
      )
    }
    list = []
    if (para.length) {
      out.push(
        <p key={`p${i}`} className={`mt-2.5 first:mt-0 ${big ? '' : 'whitespace-pre-line'}`}>
          {inline(para.join(big ? ' ' : '\n'), `p${i}`)}
        </p>,
      )
    }
    para = []
  }

  lines.forEach((l, i) => {
    if (l.trim().startsWith('```')) {
      flush(i)
      if (code) {
        out.push(<pre key={`c${i}`} className="mt-2 overflow-x-auto rounded-lg bg-surface-3 p-3 font-mono text-[12.5px] whitespace-pre text-text">{code.join('\n')}</pre>)
        code = null
      } else code = []
      return
    }
    if (code) {
      code.push(l)
      return
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(l)
    const li = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(l)
    if (li) {
      if (para.length) flush(i)
      list.push(li[1]!)
      return
    }
    if (h) {
      flush(i)
      const size = h[1]!.length === 1 ? (big ? 'text-[22px]' : 'text-[17px]') : big ? 'text-base' : 'text-[15px]'
      out.push(
        <p key={i} className={`${size} mt-[18px] mb-1.5 font-extrabold tracking-[-0.01em] text-text first:mt-0`}>
          {big && <span className="mr-1.5 font-mono font-medium text-text-faint">{h[1]}</span>}
          {inline(h[2]!, `h${i}`)}
        </p>,
      )
      return
    }
    if (!l.trim()) {
      flush(i)
      return
    }
    if (list.length) {
      list[list.length - 1] += ` ${l.trim()}`
      return
    }
    para.push(l)
  })
  flush(lines.length)
  const open = code as string[] | null
  if (open) out.push(<pre key="c-end" className="mt-2 rounded-lg bg-surface-3 p-3 font-mono text-[12.5px] whitespace-pre">{open.join('\n')}</pre>)
  return <>{out}</>
}
