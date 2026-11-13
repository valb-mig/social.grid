import { z } from 'zod'
import { isHm } from '../day.ts'
import { ids, rules } from '../network/index.ts'
import { PID } from '../project/project.ts'

export const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/

const hm = z.string().refine(isHm, 'hora inválida, use HH:MM')
const tag = z.string().max(80)
const net = z.enum(ids)

export const rule = z
  .object({
    net,
    format: z.string().max(32),
    days: z.array(z.number().int().min(0).max(6)).max(7),
    times: z.array(hm).max(8),
    on: z.boolean(),
  })
  .refine((r) => rules(r.net).some((f) => f.id === r.format), 'formato inválido para a rede')

const few = <T extends z.ZodType>(v: T, max: number) =>
  z.record(z.string().regex(PID), v).refine((r) => Object.keys(r).length <= max, `no máximo ${max} itens`)

export const schema = z.object({
  root: z
    .string()
    .max(512)
    .refine((s) => s.startsWith('/') && s.replace(/\/+$/, '') !== '', 'use um caminho absoluto que não seja a raiz')
    .nullable(),
  model: z.string().max(80).regex(/^[A-Za-z0-9.\[\]_:-]+$/).nullable(),
  nets: z.record(net, z.object({ on: z.boolean(), handle: z.string().max(80) })),
  rules: z.array(rule).max(32),
  tags: z.object({
    nets: z.record(net, z.array(tag).max(30)),
    projects: few(z.array(tag).max(30), 300),
  }),
  skills: z.array(z.string().regex(NAME)).max(16),
  agents: z.array(z.string().regex(NAME)).max(16),
  push: z.object({
    ready: z.boolean(),
    before: z.number().int().min(1).max(240),
    draft: z.boolean(),
    at: hm,
  }),
})

export type Config = z.infer<typeof schema>
export type Rule = z.infer<typeof rule>

export function defaults(): Config {
  return {
    root: null,
    model: null,
    nets: Object.fromEntries(ids.map((id) => [id, { on: true, handle: '' }])),
    rules: [
      { net: 'instagram', format: 'feed', days: [0, 2, 4], times: ['12:00'], on: true },
      { net: 'instagram', format: 'story', days: [1, 4], times: ['19:00'], on: true },
      { net: 'instagram', format: 'reels', days: [], times: [], on: false },
      { net: 'linkedin', format: 'post', days: [1, 3], times: ['08:30'], on: true },
      { net: 'linkedin', format: 'artigo', days: [], times: [], on: false },
    ],
    tags: { nets: Object.fromEntries(ids.map((id) => [id, []])), projects: {} },
    skills: ['instagram-post-writer', 'linkedin-post-writer'],
    agents: ['social-posts'],
    push: { ready: true, before: 15, draft: true, at: '09:00' },
  }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

export function merge(raw: unknown): unknown {
  const d = defaults()
  const r = obj(raw)
  const tags = obj(r.tags)
  return {
    ...d,
    ...r,
    nets: { ...d.nets, ...obj(r.nets) },
    tags: { nets: { ...d.tags.nets, ...obj(tags.nets) }, projects: obj(tags.projects) },
    push: { ...d.push, ...obj(r.push) },
  }
}

export const weekly = (r: Rule) => (r.on ? r.days.length * r.times.length : 0)

export const total = (c: Config) => c.rules.filter((r) => c.nets[r.net]?.on).reduce((n, r) => n + weekly(r), 0)
