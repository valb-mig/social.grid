import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import type { SDKMessage, SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import type { Ev, Item } from '@social-grid/core/chat.ts'
import { MCP } from './policy.ts'

type Block = {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  is_error?: boolean
  content?: unknown
  source?: { type?: string; media_type?: string; data?: string }
}

const OURS = `mcp__${MCP}__`
const MADE = `${OURS}criar_post`

export const LOGIN = 'Faça login no Claude Code: rode `claude` no terminal e use /login'
const BUSY = 'O Claude está sobrecarregado ou no limite de uso; tente de novo daqui a pouco.'
const BILL = 'A conta do Claude está sem crédito ou com a cobrança pendente.'
const MODEL = 'O modelo escolhido na config não está disponível nesta conta; troque em Config, Redes.'
const HALT = 'Turno parado.'

const CODES: Record<string, string> = {
  authentication_failed: LOGIN,
  oauth_org_not_allowed: LOGIN,
  cloud_credential_error: LOGIN,
  billing_error: BILL,
  account_on_hold: BILL,
  rate_limit: BUSY,
  overloaded: BUSY,
  model_not_found: MODEL,
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

export function why(text: string): string {
  const t = text.trim()
  if (/log ?in|api.?key|authenticat|unauthori[sz]ed|oauth|\b401\b|credential/i.test(t)) return LOGIN
  if (/overloaded|rate.?limit|usage limit|\b429\b|\b529\b/i.test(t)) return BUSY
  if (/credit balance|billing/i.test(t)) return BILL
  const first = t.split('\n')[0]?.slice(0, 200)
  return first ? `O turno terminou com erro: ${first}` : 'O turno terminou com erro.'
}

export function info(name: string, input: Record<string, unknown> = {}): string {
  if (name.startsWith(OURS)) {
    const t = name.slice(OURS.length)
    return t === 'git' ? `git ${str(input.sub)} ${Array.isArray(input.args) ? input.args.join(' ') : ''}`.trim() : `social.grid · ${t}`
  }
  if (name === 'Read') return `Read ${basename(str(input.file_path))}`
  if (name === 'Grep' || name === 'Glob') return `${name} ${str(input.pattern)}`.slice(0, 80)
  if (name === 'Skill') return `Skill ${str(input.skill) || str(input.command)}`
  if (name === 'WebFetch') {
    try {
      return `WebFetch ${new URL(str(input.url)).hostname}`
    } catch {
      return 'WebFetch'
    }
  }
  if (name === 'WebSearch') return `WebSearch ${str(input.query)}`.slice(0, 80)
  return name
}

function blocks(content: unknown): Block[] {
  if (typeof content === 'string') return [{ type: 'text', text: content }]
  return Array.isArray(content) ? (content as Block[]) : []
}

const flat = (content: unknown) =>
  blocks(content)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n')

const noise = (t: string) => !t.trim() || /^(<|Base directory for this skill|Caveat:)/.test(t.trim())
const halted = (t: string) => /^\[Request interrupted/.test(t.trim())

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

export function picture(data: Buffer, type: string): string | null {
  const ext = EXT[type]
  return ext ? `${createHash('sha256').update(data).digest('hex').slice(0, 24)}.${ext}` : null
}

function images(list: Block[]): string[] {
  return list.flatMap((b) => {
    if (b.type !== 'image' || b.source?.type !== 'base64' || !b.source.data) return []
    const name = picture(Buffer.from(b.source.data, 'base64'), b.source.media_type ?? '')
    return name ? [name] : []
  })
}

function created(b: Block): string | null {
  try {
    const id = (JSON.parse(flat(b.content)) as { post?: { id?: unknown } }).post?.id
    return typeof id === 'string' ? id : null
  } catch {
    return null
  }
}

function assistant(content: unknown): Ev[] {
  return blocks(content).flatMap((b): Ev[] => {
    if (b.type === 'text' && b.text?.trim()) return [{ k: 'text', text: b.text }]
    if (b.type === 'tool_use' && b.id && b.name) return [{ k: 'tool', id: b.id, name: b.name, info: info(b.name, b.input) }]
    return []
  })
}

function results(content: unknown, calls?: Map<string, string>): Ev[] {
  return blocks(content).flatMap((b): Ev[] => {
    if (b.type !== 'tool_result' || !b.tool_use_id) return []
    const done: Ev = { k: 'done', id: b.tool_use_id, ok: !b.is_error }
    const post = !b.is_error && calls?.get(b.tool_use_id) === MADE ? created(b) : null
    return post ? [{ k: 'post', id: post }, done] : [done]
  })
}

export function translate(m: SDKMessage): Ev[] {
  const parent = (m as { parent_tool_use_id?: string | null }).parent_tool_use_id
  if (parent) return []
  if (m.type === 'stream_event') {
    const e = m.event as { type: string; delta?: { type: string; text?: string } }
    return e.type === 'content_block_delta' && e.delta?.type === 'text_delta' && e.delta.text ? [{ k: 'delta', text: e.delta.text }] : []
  }
  if (m.type === 'assistant') {
    if (m.error) return [{ k: 'error', text: CODES[m.error] ?? why(flat(m.message.content)) }]
    return assistant(m.message.content)
  }
  if (m.type === 'user') return results(m.message.content)
  if (m.type === 'result') {
    const idle: Ev = { k: 'state', state: 'idle' }
    if (m.subtype === 'error_max_turns') return [{ k: 'error', text: 'A conversa chegou ao limite de passos deste turno.' }, idle]
    if (m.subtype !== 'success') return [{ k: 'error', text: 'O turno terminou com erro.' }, idle]
    if (m.is_error) return [{ k: 'error', text: why(m.result) }, idle]
    return [idle]
  }
  return []
}

export function history(list: SessionMessage[]): Item[] {
  const evs: Ev[] = []
  const calls = new Map<string, string>()
  for (const m of list) {
    if (m.parent_tool_use_id) continue
    const msg = m.message as { content?: unknown; model?: string } | null
    if (m.type === 'assistant') {
      if (msg?.model === '<synthetic>') {
        const text = flat(msg.content)
        if (text.trim() && evs.at(-1)?.k !== 'error') evs.push({ k: 'error', text: why(text) })
        continue
      }
      for (const b of blocks(msg?.content)) if (b.type === 'tool_use' && b.id && b.name) calls.set(b.id, b.name)
      evs.push(...assistant(msg?.content))
    }
    if (m.type === 'user') {
      const bs = blocks(msg?.content)
      const done = results(msg?.content, calls)
      if (done.length) {
        evs.push(...done)
        continue
      }
      const text = flat(msg?.content)
      const pics = images(bs)
      if (halted(text)) evs.push({ k: 'error', text: HALT })
      else if (pics.length || !noise(text)) evs.push({ k: 'user', text, ...(pics.length ? { images: pics } : {}) })
    }
  }
  return evs.map((ev, i) => ({ seq: i + 1, ev }))
}
