import { execFile } from 'node:child_process'
import { isIP } from 'node:net'
import { promisify } from 'node:util'
import type { Policy } from './guard.ts'

const run = promisify(execFile)

export type Exec = (args: string[]) => Promise<string>

export const bin =
  (path: string, ms = 10_000): Exec =>
  async (args) =>
    (await run(path, args, { timeout: ms, maxBuffer: 4 << 20 })).stdout

export type Node = { DNSName?: string; HostName?: string; OS?: string; Online?: boolean; UserID?: number }

export type Status = {
  BackendState?: string
  CertDomains?: string[] | null
  CurrentTailnet?: { MagicDNSEnabled?: boolean } | null
  Self?: Node
  Peer?: Record<string, Node> | null
  User?: Record<string, { LoginName?: string }> | null
}

export const name = (s: Status) => s.Self?.DNSName?.replace(/\.$/, '') || null

export const owner = (s: Status) => s.User?.[String(s.Self?.UserID)]?.LoginName ?? null

export function hosts(name: string, port: number): string[] {
  return port === 443 ? [name, `${name}:443`] : [`${name}:${port}`]
}

export async function refresh(p: Policy, port: number, fixed: string[], exec: Exec = bin('tailscale', 5_000)): Promise<boolean> {
  try {
    const s = JSON.parse(await exec(['status', '--json'])) as Status
    const host = name(s)
    const login = owner(s)
    if (!host || !login) throw new Error('tailscale sem nó')
    p.tailnet = new Set(hosts(host, port))
    p.logins = new Set(fixed.length ? fixed : [login])
    return true
  } catch {
    p.tailnet = new Set()
    return false
  }
}

type Whois = { Node?: { ComputedName?: string; Name?: string; Hostinfo?: { Hostname?: string } } }

const TTL = 10 * 60_000
const names = new Map<string, { at: number; name: Promise<string | null> }>()

export function whois(ip: string, exec: Exec = bin('tailscale', 3_000)): Promise<string | null> {
  if (!isIP(ip)) return Promise.resolve(null)
  const hit = names.get(ip)
  if (hit && Date.now() - hit.at < TTL) return hit.name
  const name = exec(['whois', '--json', ip])
    .then((out) => {
      const n = (JSON.parse(out) as Whois).Node
      const raw = n?.ComputedName || n?.Name?.split('.')[0] || n?.Hostinfo?.Hostname || ''
      return raw.replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 40) || null
    })
    .catch(() => null)
  names.set(ip, { at: Date.now(), name })
  return name
}
