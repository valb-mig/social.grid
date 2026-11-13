import { mkdir, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'

export type Call = { name: string; input: Record<string, unknown> }
export type Seen = { call: Call; error: boolean; text: string }
type Block = { type: string; text?: string; tool_use_id?: string; is_error?: boolean; content?: unknown }

const flat = (c: unknown): string =>
  typeof c === 'string' ? c : Array.isArray(c) ? (c as Block[]).map((b) => (b.type === 'text' ? (b.text ?? '') : b.type === 'tool_result' ? flat(b.content) : '')).join('\n') : ''

export function api(script: Call[]) {
  const seen: Seen[] = []
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      if (!req.url?.startsWith('/v1/messages') || req.url.includes('count_tokens')) {
        res.writeHead(200, { 'content-type': 'application/json' })
        return res.end('{"input_tokens":10}')
      }
      const body = JSON.parse(raw || '{}') as { tools?: { name: string }[]; messages?: { role: string; content: unknown }[] }
      const main = (body.tools ?? []).some((t) => t.name === 'Read')
      const msgs = body.messages ?? []
      const step = msgs.filter((m) => m.role === 'assistant' && Array.isArray(m.content) && (m.content as Block[]).some((b) => b.type === 'tool_use')).length
      if (main && step > 0) {
        const id = `toolu_${step - 1}`
        const r = msgs.flatMap((m) => (Array.isArray(m.content) ? (m.content as Block[]) : [])).find((b) => b.type === 'tool_result' && b.tool_use_id === id)
        if (r && seen.length < step) seen.push({ call: script[step - 1]!, error: !!r.is_error, text: flat(r.content) })
      }
      const next = main ? script[step] : undefined
      const id = `toolu_${step}`
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      const ev = (type: string, data: object) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`)
      ev('message_start', { message: { id: `msg_${Date.now()}`, type: 'message', role: 'assistant', model: 'claude-teste', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } })
      if (next) {
        ev('content_block_start', { index: 0, content_block: { type: 'tool_use', id, name: next.name, input: {} } })
        ev('content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(next.input) } })
      } else {
        ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
        ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'pronto' } })
      }
      ev('content_block_stop', { index: 0 })
      ev('message_delta', { delta: { stop_reason: next ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } })
      ev('message_stop', {})
      res.end()
    })
  })
  return new Promise<{ url: string; seen: Seen[]; close: () => void }>((ok) =>
    server.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen, close: () => server.close() })),
  )
}


export function env(home: string, url: string | null) {
  for (const k of Object.keys(process.env)) if (k.startsWith('CLAUDE') || k.startsWith('ANTHROPIC')) delete process.env[k]
  Object.assign(process.env, {
    HOME: home,
    CLAUDE_CONFIG_DIR: join(home, '.claude'),
    ...(url ? { ANTHROPIC_API_KEY: 'sk-ant-api03-teste', ANTHROPIC_BASE_URL: url } : {}),
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    DISABLE_AUTOUPDATER: '1',
    DISABLE_TELEMETRY: '1',
    DISABLE_ERROR_REPORTING: '1',
  })
}

export async function home(base: string) {
  const h = join(base, 'home')
  await mkdir(join(h, '.claude'), { recursive: true })
  await writeFile(join(h, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true, numStartups: 3, projects: {} }))
  return h
}
