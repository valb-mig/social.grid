import { kind } from '../media.ts'
import { hashes, tags, type Post } from '../post/post.ts'

export type Level = 'error' | 'warn' | 'ok'
export type Issue = { level: Level; code: string; text: string }

export type Format = {
  id: string
  name: string
  hint: string
  min: number
  max: number
  video?: boolean
  under?: string
  more?: string
}

export type Pack = { media: string[]; caption: string; tags: string; comment: string; text: string }

export type Net = {
  id: string
  name: string
  formats: Format[]
  max: number
  hook: number
  ideal: [number, number]
  cap: number
  check(post: Post): Issue[]
  pack(post: Post): Pack
}

export const errors = (list: Issue[]) => list.filter((i) => i.level === 'error')

export const len = (s: string) => [...s].length

export const num = (n: number) => n.toLocaleString('pt-BR')

export function pack(post: Post): Pack {
  const t = hashes(post.hashtags)
  const caption = post.caption.trim()
  return {
    media: [...post.media],
    caption,
    tags: t,
    comment: post.comment.trim(),
    text: [caption, t].filter(Boolean).join('\n\n'),
  }
}

export function hook(caption: string, n: number): { head: string; fits: boolean } {
  const first = caption.trim().split(/\n/)[0] ?? ''
  return { head: [...first].slice(0, n).join(''), fits: len(first) <= n }
}

export function count(post: Post): number {
  const inline = [...post.caption.matchAll(/(?:^|\s)#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]!)
  return tags([...post.hashtags, ...inline]).length
}

export const issue = (level: Level, code: string, text: string): Issue => ({ level, code, text })

export function size(net: Net, post: Post, f: Format): Issue {
  const n = post.media.length
  const range = f.min === f.max ? `${f.max}` : `${f.min} a ${f.max}`
  const what = `${f.name} com ${n} ${n === 1 ? 'mídia' : 'mídias'} (${range})`
  if (n < f.min) return issue('error', 'media_min', f.min === 1 && n === 0 ? `${f.name} precisa de mídia` : `${what}`)
  if (n > f.max) return issue('error', 'media_max', what)
  if (f.video && post.media.some((m) => kind(m) !== 'video')) return issue('error', 'media_video', `${f.name} aceita só vídeo`)
  return issue('ok', 'media', f.max === 0 ? `${net.name} sem mídia` : what)
}

export function length(net: Net, post: Post): Issue {
  const n = len(pack(post).text)
  if (n > net.max) return issue('error', 'length', `Legenda em ${num(n)} de ${num(net.max)}: passou do limite`)
  return issue('ok', 'length', `Legenda em ${num(n)} de ${num(net.max)}`)
}

export function fold(net: Net, post: Post): Issue {
  return hook(post.caption, net.hook).fits
    ? issue('ok', 'hook', 'Gancho cabe antes do "mais"')
    : issue('warn', 'hook', `Primeira linha passa de ${net.hook} letras e é cortada no "mais"`)
}

export function many(net: Net, post: Post): Issue {
  const n = count(post)
  const [lo, hi] = net.ideal
  if (n > net.cap) return issue('error', 'tags_max', `${n} hashtags: o limite é ${net.cap}`)
  if (n < lo || n > hi) return issue('warn', 'tags_ideal', `${n} ${n === 1 ? 'hashtag' : 'hashtags'}, ideal ${lo} a ${hi}`)
  return issue('ok', 'tags', `${n} hashtags, dentro do ideal`)
}

export function known(net: Net, post: Post): Format | Issue {
  return net.formats.find((f) => f.id === post.format) ?? issue('error', 'format', `Formato ${post.format} não existe no ${net.name}`)
}
