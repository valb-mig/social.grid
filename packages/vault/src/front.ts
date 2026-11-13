import { parse, stringify } from 'yaml'

export type Split = { front: string; body: string }

export function split(text: string): Split | null {
  const t = text.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  if (!t.startsWith('---\n')) return null
  const end = t.indexOf('\n---', 3)
  if (end < 0) return null
  const after = t.slice(end + 4)
  if (after !== '' && !after.startsWith('\n')) return null
  return { front: t.slice(4, end + 1), body: after.slice(1) }
}

export function read(front: string): Record<string, unknown> {
  const v: unknown = parse(front, { schema: 'core', maxAliasCount: 0, prettyErrors: false })
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

export const dump = (data: Record<string, unknown>) => stringify(data, { lineWidth: 0 })
