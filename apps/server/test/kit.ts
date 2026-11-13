import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bus } from '@social-grid/core/bus.ts'
import { ops } from '@social-grid/core/post/ops.ts'
import { open } from '@social-grid/vault/open.ts'
import { policy } from '../src/guard.ts'
import { build } from '../src/http/app.ts'
import { skills } from '../src/skills/skills.ts'
import type { Deps } from '../src/http/deps.ts'
import { room } from '../src/ws.ts'

export const LOCAL = '127.0.0.1:7338'
export const ORIGIN = `http://${LOCAL}`
export const TAIL = 'pc.tail1234.ts.net:8443'

export async function kit(extra: Partial<Deps> = {}) {
  const base = await mkdtemp(join(tmpdir(), 'sg-server-'))
  const home = join(base, 'home')
  const root = join(home, 'Projects')
  await mkdir(join(root, 'mocha.app', '.git'), { recursive: true })
  const v = open(join(base, 'vault'), home)
  await v.cfg.save({ root })
  const b = bus()
  const now = () => new Date('2026-11-13T10:00:00')
  const pol = policy([LOCAL, 'localhost:7338'])
  pol.tailnet = new Set([TAIL])
  pol.logins = new Set(['valb@github'])
  const app = await build({
    ops: ops({ repo: v.repo, config: v.cfg.load, bus: b, now, known: async (id) => !!(await v.projects.get(id)) }),
    repo: v.repo,
    cfg: v.cfg,
    projects: v.projects,
    bus: b,
    now,
    policy: pol,
    push: null,
    chat: null,
    skills: skills(() => home),
    room: room(),
    web: null,
    vault: v.dir,
    home,
    ...extra,
  })
  return { app, v, home, root, base, bus: b }
}

export const json = { host: LOCAL, origin: ORIGIN, 'content-type': 'application/json' }

export function form(name: string, type: string, data: Buffer) {
  const boundary = '----sg' + Math.random().toString(16).slice(2)
  const head = `--${boundary}\r\ncontent-disposition: form-data; name="file"; filename="${name}"\r\ncontent-type: ${type}\r\n\r\n`
  const body = Buffer.concat([Buffer.from(head), data, Buffer.from(`\r\n--${boundary}--\r\n`)])
  return { headers: { host: LOCAL, origin: ORIGIN, 'content-type': `multipart/form-data; boundary=${boundary}` }, body }
}

export const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4a60000000049454e44ae426082', 'hex')
