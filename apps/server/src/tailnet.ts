import { execFile } from 'node:child_process'
import { isIP } from 'node:net'
import { promisify } from 'node:util'
import type { Policy } from './guard.ts'

const exec = promisify(execFile)

type Status = {
  Self?: { DNSName?: string; UserID?: number }
  User?: Record<string, { LoginName?: string }>
}

export function hosts(name: string, port: number): string[] {
  return port === 443 ? [name, `${name}:443`] : [`${name}:${port}`]
}

export async function refresh(p: Policy, port: number, fixed: string[]): Promise<boolean> {
  try {
    const { stdout } = await exec('tailscale', ['status', '--json'], { timeout: 5_000, maxBuffer: 4 << 20 })
    const s = JSON.parse(stdout) as Status
    const name = s.Self?.DNSName?.replace(/\.$/, '')
    const owner = s.User?.[String(s.Self?.UserID)]?.LoginName
    if (!name || !owner) throw new Error('tailscale sem nó')
    p.tailnet = new Set(hosts(name, port))
    p.logins = new Set(fixed.length ? fixed : [owner])
    return true
  } catch {
    p.tailnet = new Set()
    return false
  }
}

type Whois = { Node?: { ComputedName?: string; Name?: string; Hostinfo?: { Hostname?: string } } }

const TTL = 10 * 60_000
const names = new Map<string, { at: number; name: Promise<string | null> }>()

export function whois(ip: string): Promise<string | null> {
  if (!isIP(ip)) return Promise.resolve(null)
  const hit = names.get(ip)
  if (hit && Date.now() - hit.at < TTL) return hit.name
  const name = exec('tailscale', ['whois', '--json', ip], { timeout: 3_000, maxBuffer: 1 << 20 })
    .then(({ stdout }) => {
      const n = (JSON.parse(stdout) as Whois).Node
      const raw = n?.ComputedName || n?.Name?.split('.')[0] || n?.Hostinfo?.Hostname || ''
      return raw.replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 40) || null
    })
    .catch(() => null)
  names.set(ip, { at: Date.now(), name })
  return name
}
