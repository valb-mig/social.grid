import { fail } from './fault.ts'

export type Day = string
export type Hm = string

export const MAX_SPAN = 93

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const HM = /^([01]\d|2[0-3]):([0-5]\d)$/

const pad = (n: number) => String(n).padStart(2, '0')

export const fmt = (d: Date): Day => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function parse(s: string): Date | null {
  const m = DAY.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return fmt(d) === s ? d : null
}

export const isDay = (s: unknown): s is Day => typeof s === 'string' && parse(s) !== null
export const isHm = (s: unknown): s is Hm => typeof s === 'string' && HM.test(s)

function must(s: Day): Date {
  return parse(s) ?? fail('invalid', `data inválida: ${s}`)
}

export const today = (now: Date): Day => fmt(now)
export const clock = (now: Date): Hm => `${pad(now.getHours())}:${pad(now.getMinutes())}`

export function add(d: Day, n: number): Day {
  const x = must(d)
  x.setDate(x.getDate() + n)
  return fmt(x)
}

export const weekday = (d: Day): number => (must(d).getDay() + 6) % 7
export const monday = (d: Day): Day => add(d, -weekday(d))
export const span = (a: Day, b: Day): number => Math.round((must(b).getTime() - must(a).getTime()) / 864e5)

export function at(d: Day, t: Hm): Date {
  const x = must(d)
  const [h, m] = t.split(':').map(Number)
  x.setHours(h ?? 0, m ?? 0, 0, 0)
  return x
}

export const mins = (from: Date, to: Date): number => Math.round((to.getTime() - from.getTime()) / 6e4)

export function days(from: Day, to: Day): Day[] {
  const out: Day[] = []
  for (let d = from; d <= to; d = add(d, 1)) out.push(d)
  return out
}

export function range(from: unknown, to: unknown): [Day, Day] {
  if (!isDay(from) || !isDay(to)) fail('invalid', 'use datas YYYY-MM-DD')
  if (to < from) fail('invalid', 'a data final vem antes da inicial')
  if (span(from, to) > MAX_SPAN) fail('invalid', `intervalo maior que ${MAX_SPAN} dias`)
  return [from, to]
}

export const WEEK = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function label(d: Day): string {
  const x = must(d)
  return `${WEEK[weekday(d)]}, ${x.getDate()} ${MONTHS[x.getMonth()]!.slice(0, 3)}`
}
