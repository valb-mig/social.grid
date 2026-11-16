import type { Policy } from './guard.ts'
import { name, owner, refresh, type Exec, type Status } from './tailnet.ts'

export type Phone = { name: string; os: string; online: boolean }

export type Id = 'missing' | 'stopped' | 'dns' | 'https' | 'serve' | 'busy' | 'operator' | 'failed' | 'off' | 'phone'

export type Todo = { id: Id; text: string; cmd?: string; links?: { label: string; href: string }[] }

export type State = 'on' | 'off' | 'busy'

export type Check = {
  tailscale: 'missing' | 'stopped' | 'running'
  login: string | null
  dns: boolean
  https: boolean
  serve: number
  port: number
  state: State
  target: string | null
  url: string | null
  phones: Phone[]
  todo: Todo[]
}

export type Link = {
  check(want: boolean): Promise<Check>
  on(): Promise<boolean>
  off(): Promise<boolean>
  boot(want: boolean): Promise<string | null>
}

export class Block extends Error {
  todo: Todo

  constructor(todo: Todo) {
    super(todo.text)
    this.todo = todo
  }
}

type Handler = { Proxy?: string; Path?: string; Text?: string }

export type Serve = {
  TCP?: Record<string, { HTTPS?: boolean; HTTP?: boolean; TCPForward?: string }> | null
  Web?: Record<string, { Handlers?: Record<string, Handler> | null }> | null
}

type At = { state: State; target: string | null }

type Opts = { exec: Exec; port: number; serve: number; user: string; policy?: Policy; logins?: string[] }

const DNS = 'https://login.tailscale.com/admin/dns'
const MOBILE = /^(android|ios)$/i
const STORES = [
  { label: 'Android', href: 'https://play.google.com/store/apps/details?id=com.tailscale.ipn' },
  { label: 'iPhone', href: 'https://apps.apple.com/app/tailscale/id1470499037' },
]

const MISSING: Todo = { id: 'missing', text: 'Instale o Tailscale no PC e entre com a sua conta.', links: [{ label: 'Baixar', href: 'https://tailscale.com/download' }] }
const STOPPED: Todo = { id: 'stopped', text: 'O Tailscale está parado no PC. Ligue e entre com a sua conta.', cmd: 'sudo tailscale up' }
const NODNS: Todo = { id: 'dns', text: 'Ligue o MagicDNS no painel de DNS do Tailscale.', links: [{ label: 'Abrir o painel', href: DNS }] }
const NOHTTPS: Todo = { id: 'https', text: 'Ligue os certificados HTTPS no painel de DNS do Tailscale, em HTTPS Certificates.', links: [{ label: 'Abrir o painel', href: DNS }] }

const first = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean) ?? ''

const strip = (s?: string) => s?.replace(/\/$/, '') ?? ''

const dead = (e: unknown) => (e as { code?: unknown }).code === 'ENOENT'

export function link(o: Opts): Link {
  const ours = new Set([`http://127.0.0.1:${o.port}`, `http://localhost:${o.port}`])
  const key = String(o.serve)
  const operator: Todo = { id: 'operator', text: 'O Tailscale só deixa publicar com sudo. Rode uma vez no PC e tente de novo.', cmd: `sudo tailscale set --operator=${o.user}` }
  const busy = (target: string | null): Todo => ({
    id: 'busy',
    text: `A porta ${o.serve} da tailnet já leva a ${target ?? 'outro serviço'}. O app não mexe nela: libere a porta ou rode o app com outra em SOCIAL_GRID_SERVE_PORT.`,
  })
  const off = (want: boolean): Todo =>
    want ? { id: 'off', text: 'O link ainda não está no ar.' } : { id: 'off', text: 'Publicar na tailnet está desligado. Só o PC abre o app.' }
  const phone = (login: string | null): Todo => ({
    id: 'phone',
    text: login ? `Instale o Tailscale no celular e entre com ${login}.` : 'Instale o Tailscale no celular e entre com a mesma conta do PC.',
    links: STORES,
  })

  let last: { op: 'on' | 'off'; todo: Todo } | null = null
  let done = false

  function why(e: unknown): Todo {
    if (dead(e)) return MISSING
    const err = e as { stdout?: string; stderr?: string; message?: string; killed?: boolean }
    const out = [err.stderr, err.stdout].filter(Boolean).join('\n').trim() || err.message || ''
    if (/access denied|sudo|operator/i.test(out)) return operator
    const url = out.match(/https:\/\/login\.tailscale\.com\/\S+/)?.[0]
    if (url) return { id: 'serve', text: 'O Tailscale pede para liberar o Serve nesta tailnet. Abra o link, libere e tente de novo.', links: [{ label: 'Liberar o Serve', href: url }] }
    if (/(https|certificate)[^\n]{0,40}(not enabled|disabled)|enable https/i.test(out)) return NOHTTPS
    if (/tailscaled|not running|needslogin|logged out/i.test(out)) return STOPPED
    if (err.killed) return { id: 'failed', text: 'O tailscale serve não respondeu em 10 segundos.' }
    return { id: 'failed', text: `O tailscale serve falhou: ${first(out).slice(0, 200) || 'erro desconhecido'}` }
  }

  async function read(): Promise<{ ts: Check['tailscale']; s: Status | null }> {
    try {
      const s = JSON.parse(await o.exec(['status', '--json'])) as Status
      return { ts: s.BackendState === 'Running' ? 'running' : 'stopped', s }
    } catch (e) {
      return { ts: dead(e) ? 'missing' : 'stopped', s: null }
    }
  }

  async function served(): Promise<Serve> {
    const out = (await o.exec(['serve', 'status', '--json'])).trim()
    return out ? ((JSON.parse(out) as Serve | null) ?? {}) : {}
  }

  function where(c: Serve, host: string | null): At {
    const tcp = c.TCP?.[key]
    const webs = Object.entries(c.Web ?? {}).filter(([k]) => k.endsWith(`:${key}`))
    const web = (webs.find(([k]) => k === `${host}:${key}`) ?? webs[0])?.[1]
    if (!tcp && !web) return { state: 'off', target: null }
    const list = web?.Handlers ?? {}
    const root = list['/']
    if (tcp?.HTTPS && ours.has(strip(root?.Proxy))) return { state: 'on', target: strip(root?.Proxy) }
    const h = root ?? Object.values(list)[0]
    if (tcp?.TCPForward) return { state: 'busy', target: `tcp ${tcp.TCPForward}` }
    if (h?.Proxy) return { state: 'busy', target: strip(h.Proxy) }
    if (h?.Path) return { state: 'busy', target: `a pasta ${h.Path}` }
    return { state: 'busy', target: h?.Text !== undefined ? 'um texto fixo' : 'outro serviço' }
  }

  function phones(s: Status): Phone[] {
    const me = owner(s)
    const allowed = new Set(o.logins?.length ? o.logins : me ? [me] : [])
    return Object.values(s.Peer ?? {})
      .filter((p) => MOBILE.test(p.OS ?? '') && allowed.has(s.User?.[String(p.UserID)]?.LoginName ?? ''))
      .map((p) => ({ name: p.DNSName?.split('.')[0] || p.HostName || '?', os: /ios/i.test(p.OS ?? '') ? 'iOS' : 'Android', online: !!p.Online }))
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name))
  }

  const run = (op: 'on' | 'off', args: string[]) =>
    o.exec(args).catch((e: unknown) => {
      const todo = why(e)
      last = { op, todo }
      throw new Block(todo)
    })

  async function ready(): Promise<{ s: Status; at: At }> {
    const { ts, s } = await read()
    if (ts !== 'running' || !s) throw new Block(ts === 'missing' ? MISSING : STOPPED)
    const c = await served().catch((e: unknown) => {
      throw new Block(why(e))
    })
    return { s, at: where(c, name(s)) }
  }

  async function check(want: boolean): Promise<Check> {
    const { ts, s } = await read()
    const base: Check = {
      tailscale: ts,
      login: s ? owner(s) : null,
      dns: !!s?.CurrentTailnet?.MagicDNSEnabled,
      https: !!s?.CertDomains?.length,
      serve: o.serve,
      port: o.port,
      state: 'off',
      target: null,
      url: null,
      phones: [],
      todo: [],
    }
    if (ts !== 'running' || !s) return { ...base, todo: [ts === 'missing' ? MISSING : STOPPED] }
    const host = name(s)
    let at: At = { state: 'off', target: null }
    let fail: Todo | null = null
    try {
      at = where(await served(), host)
    } catch (e) {
      fail = why(e)
    }
    if (last && (last.op === 'on') === (at.state === 'on')) last = null
    const list = phones(s)
    const block = [!base.dns && NODNS, !base.https && NOHTTPS, at.state === 'busy' && busy(at.target), fail, last?.todo].filter((t): t is Todo => !!t)
    const rest = [at.state === 'off' && !block.length && off(want), !list.length && phone(base.login)].filter((t): t is Todo => !!t)
    const todo = [...block, ...rest].filter((t, i, all) => all.findIndex((x) => x.id === t.id) === i)
    return { ...base, ...at, url: host ? (o.serve === 443 ? `https://${host}` : `https://${host}:${o.serve}`) : null, phones: list, todo }
  }

  async function on(): Promise<boolean> {
    const { s, at } = await ready()
    if (!s.CurrentTailnet?.MagicDNSEnabled) throw new Block(NODNS)
    if (!s.CertDomains?.length) throw new Block(NOHTTPS)
    if (at.state === 'busy') throw new Block(busy(at.target))
    const wrote = at.state === 'off'
    if (wrote) await run('on', ['serve', '--bg', `--https=${o.serve}`, String(o.port)])
    last = null
    if (o.policy) await refresh(o.policy, o.serve, o.logins ?? [], o.exec)
    return wrote
  }

  async function stop(): Promise<boolean> {
    const { at } = await ready()
    const wrote = at.state === 'on'
    if (wrote) await run('off', ['serve', `--https=${o.serve}`, 'off'])
    last = null
    return wrote
  }

  async function boot(want: boolean): Promise<string | null> {
    if (done) return null
    if (!want) {
      done = true
      return 'off'
    }
    if ((await read()).ts !== 'running') return 'wait'
    done = true
    try {
      return (await on()) ? 'new' : 'on'
    } catch (e) {
      if (e instanceof Block) return e.todo.id
      throw e
    }
  }

  return { check, on, off: stop, boot }
}
