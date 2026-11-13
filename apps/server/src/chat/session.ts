import { randomUUID } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { createSdkMcpServer, query, tool, type CanUseTool, type HookCallback } from '@anthropic-ai/claude-agent-sdk'
import type { Ev, Item, State } from '@social-grid/core/chat.ts'
import { reply, tools, type Ctx } from '@social-grid/mcp/tools.ts'
import { translate, why } from './events.ts'
import { description, git, shape } from './git.ts'
import { allow, DENY, MCP, TOOLS, WEB, type Scope } from './policy.ts'
import { Queue, type Content } from './queue.ts'

const KEEP = 4000
const TURNS = 40
const INHERITED = ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SSE_PORT', 'CLAUDE_AGENT_SDK_VERSION', 'CLAUDE_CODE_MESSAGING_SOCKET', 'CLAUDE_CODE_MESSAGING_TOKEN']

export function real(path: string): string | null {
  let cur = resolve(path)
  const rest: string[] = []
  for (;;) {
    try {
      return join(realpathSync(cur), ...rest)
    } catch {
      const up = dirname(cur)
      if (up === cur) return null
      rest.unshift(basename(cur))
      cur = up
    }
  }
}

export function scope(dirs: string[]): Scope {
  const roots = dirs.map((d) => real(d)).filter((d): d is string => !!d)
  return { roots, real, web: WEB }
}

function env(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: 'social-grid/0.1' }
  for (const k of INHERITED) delete out[k]
  return out
}

export type Pic = { name: string; type: string; data: Buffer }

export type Live = {
  epoch: string
  state(): State
  idle(): number
  send(text: string, pics?: Pic[]): void
  stop(): Promise<void>
  close(): void
  kill(): void
  events(after: number): Item[]
}

export type Opts = {
  cwd: string
  model?: string
  resume?: string
  append: string
  scope: Scope
  ctx: Ctx
  history: Item[]
  emit: (epoch: string, seq: number | null, ev: Ev) => void
  sdk: (id: string) => void
  exit: () => void
}

function content(text: string, pics: Pic[]): Content {
  if (!pics.length) return text
  return [
    ...pics.map((p) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: p.type as 'image/png', data: p.data.toString('base64') } })),
    { type: 'text' as const, text: text || 'Veja a imagem.' },
  ]
}

export function live(o: Opts): Live {
  const input = new Queue()
  const abort = new AbortController()
  const epoch = randomUUID().slice(0, 8)
  const buf: Item[] = [...o.history]
  let seq = buf.at(-1)?.seq ?? 0
  let st: State = 'idle'
  let since = Date.now()
  let pending = 0
  let halted = false
  let erred = false

  const emit = (ev: Ev) => {
    if (ev.k === 'delta') return o.emit(epoch, null, ev)
    if (ev.k === 'state') {
      if (ev.state === 'idle' && pending > 0 && --pending > 0) return
      if (ev.state === st) return
      st = ev.state
      since = Date.now()
      if (st === 'running') erred = false
    }
    if (ev.k === 'error') {
      if (erred) return
      erred = true
    }
    const item = { seq: ++seq, ev }
    buf.push(item)
    if (buf.length > KEEP) buf.splice(0, buf.length - KEEP)
    o.emit(epoch, item.seq, ev)
  }

  const check = (name: string, input: Record<string, unknown>) => allow(name, input, o.scope)

  const hook: HookCallback = async (h) => {
    if (h.hook_event_name !== 'PreToolUse') return {}
    const v = check(h.tool_name, (h.tool_input ?? {}) as Record<string, unknown>)
    return {
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: v.ok ? 'allow' : 'deny', permissionDecisionReason: v.ok ? 'liberado pelo social.grid' : v.why },
    }
  }

  const canUseTool: CanUseTool = async (name, inp) => {
    const v = check(name, inp)
    return v.ok ? { behavior: 'allow', updatedInput: inp } : { behavior: 'deny', message: v.why }
  }

  const server = createSdkMcpServer({
    name: MCP,
    version: '0.1.0',
    tools: [
      ...tools.map((t) =>
        tool(
          t.name,
          t.description,
          t.shape,
          (args) =>
            reply(async () => {
              const data = await t.run(o.ctx, args)
              const id = (data as { post?: { id?: string } }).post?.id
              if (t.name === 'criar_post' && id) emit({ k: 'post', id })
              return data
            }),
          { annotations: { readOnlyHint: t.read, destructiveHint: false } },
        ),
      ),
      tool('git', description, shape, (a) => reply(() => git(o.cwd, a.sub, a.args)), { annotations: { readOnlyHint: true } }),
    ],
  })

  const q = query({
    prompt: input,
    options: {
      cwd: o.cwd,
      model: o.model,
      resume: o.resume,
      permissionMode: 'default',
      tools: TOOLS,
      disallowedTools: DENY,
      settingSources: ['user'],
      strictMcpConfig: true,
      mcpServers: { [MCP]: server },
      systemPrompt: { type: 'preset', preset: 'claude_code', append: o.append },
      canUseTool,
      hooks: { PreToolUse: [{ hooks: [hook] }] },
      includePartialMessages: true,
      maxTurns: TURNS,
      abortController: abort,
      env: env(),
      stderr: () => undefined,
    },
  })

  void (async () => {
    try {
      for await (const m of q) {
        if (m.type === 'system' && m.subtype === 'init') o.sdk(m.session_id)
        for (const ev of translate(m)) {
          if (ev.k === 'error' && halted) emit({ k: 'error', text: 'Turno parado.' })
          else emit(ev)
          if (ev.k === 'state' && ev.state === 'idle') halted = false
        }
      }
    } catch (err) {
      if (!abort.signal.aborted) emit({ k: 'error', text: err instanceof Error ? why(err.message) : 'O Claude Code parou.' })
    } finally {
      emit({ k: 'state', state: 'closed' })
      o.exit()
    }
  })()

  return {
    epoch,
    state: () => st,
    idle: () => (st === 'idle' ? since : Number.POSITIVE_INFINITY),
    send(text, pics = []) {
      input.push(content(text, pics))
      pending++
      emit({ k: 'user', text, ...(pics.length ? { images: pics.map((p) => p.name) } : {}) })
      emit({ k: 'state', state: 'running' })
    },
    async stop() {
      if (st !== 'running') return
      halted = true
      await q.interrupt()
    },
    close: () => input.close(),
    kill() {
      input.close()
      abort.abort()
    },
    events: (after) => buf.filter((i) => i.seq > after),
  }
}
