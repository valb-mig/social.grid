import { at, label, mins, MONTHS, today, weekday, WEEK } from '@social-grid/core/day.ts'
import { find } from '@social-grid/core/network/index.ts'
import { errors } from '@social-grid/core/network/net.ts'
import { check } from '@social-grid/core/post/ops.ts'
import type { Post } from '@social-grid/core/post/post.ts'

export function ago(iso: string | null, now = new Date()): string {
  if (!iso) return 'sem commits'
  const m = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 6e4))
  if (m < 60) return `há ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  if (d === 1) return 'ontem'
  if (d < 14) return `há ${d} dias`
  if (d < 60) return `há ${Math.round(d / 7)} semanas`
  return `há ${Math.round(d / 30)} meses`
}

export function until(p: Post, now = new Date()): string | null {
  if (!p.date || !p.time || p.date !== today(now)) return null
  const m = mins(now, at(p.date, p.time))
  if (m < 0) return null
  if (m < 60) return `em ${m} min`
  return `em ${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim()
}

export const late = (p: Post, now = new Date()) => p.status !== 'posted' && !!p.date && !!p.time && p.date === today(now) && mins(now, at(p.date, p.time)) < 0

export const next = (list: Post[]) => list.find((p) => p.status !== 'posted')

export const short = (d: string) => `${WEEK[weekday(d)]} ${Number(d.slice(8))}`

export const when = (p: Post) => (p.date ? `${short(p.date)}${p.time ? ` · ${p.time}` : ''}` : 'sem data')

export const longDay = (d: string) => {
  const names = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']
  return `${names[weekday(d)]}, ${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]!.slice(0, 3)}`
}

export { label }

export function kind(p: Post): string {
  const net = find(p.network)
  const f = net?.formats.find((x) => x.id === p.format)
  const n = p.media.length
  const extra = p.format === 'carrossel' ? ` · ${n} ${n === 1 ? 'slide' : 'slides'}` : ''
  return `${net?.name ?? p.network} · ${p.type || (f?.name ?? p.format).toLowerCase()}${extra}`
}

export function need(p: Post): string | null {
  if (p.status === 'posted') return null
  const e = errors(check(p))[0]
  if (!e) return null
  const f = find(p.network)?.formats.find((x) => x.id === p.format)
  const n = p.media.length
  if (e.code === 'media_video' || (e.code === 'media_min' && f?.video)) return 'falta o vídeo'
  if (e.code === 'media_min') {
    const miss = (f?.min ?? 1) - n
    return n === 0 ? 'falta a mídia' : miss > 1 ? `faltam ${miss} mídias` : 'falta 1 mídia'
  }
  if (e.code === 'media_max') return 'mídia demais'
  if (e.code === 'caption') return p.network === 'linkedin' ? 'falta o texto' : 'falta a legenda'
  if (e.code === 'length') return 'texto longo demais'
  if (e.code === 'tags_max') return 'hashtags demais'
  return e.text.toLowerCase()
}

export const home = (path: string, root: string) => {
  const h = root.replace(/\/Projects\/?$/, '')
  return h && path.startsWith(h) ? `~${path.slice(h.length)}` : path
}

export const spin = (id: string) => {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return (Math.abs(h) % 17) - 8
}
