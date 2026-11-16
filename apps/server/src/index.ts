import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { userInfo } from 'node:os'
import { join } from 'node:path'
import { bus } from '@social-grid/core/bus.ts'
import { ops } from '@social-grid/core/post/ops.ts'
import type { Ctx } from '@social-grid/mcp/tools.ts'
import { open } from '@social-grid/vault/open.ts'
import { watch } from '@social-grid/vault/watch.ts'
import { hub } from './chat/hub.ts'
import { pics } from './chat/pics.ts'
import { clock } from './clock.ts'
import { DEV, HOME, HOST, LOGINS, PORT, SERVE, STATE, TAILSCALE, VAULT, WEB } from './env.ts'
import { policy } from './guard.ts'
import { build } from './http/app.ts'
import { link } from './link.ts'
import { push } from './push/push.ts'
import { remind } from './push/remind.ts'
import { skills } from './skills/skills.ts'
import { state } from './state.ts'
import { bin, refresh, whois } from './tailnet.ts'
import { room } from './ws.ts'

const now = () => new Date()
const st = await state(STATE)
const v = open(VAULT, HOME)
await mkdir(v.dir, { recursive: true })

const b = bus()
const known = async (id: string) => !!(await v.projects.get(id))
const o = ops({ repo: v.repo, config: v.cfg.load, bus: b, now, known })
const ctx: Ctx = { ops: o, repo: v.repo, config: v.cfg.load, projects: v.projects, roots: async () => [await v.cfg.projects(), v.dir], now }

const unwatch = await watch(v.dir, b, { post: v.repo.mine, config: v.cfg.mine })
const p = await push(st)
const r = room()
const imgs = pics(join(st.dir, 'pics'))
const chat = hub({
  state: st,
  projects: v.projects,
  ctx,
  vault: v.dir,
  home: HOME,
  config: v.cfg.load,
  posts: v.repo.list,
  now,
  pics: imgs,
  on: (id, epoch, seq, ev) => r.send({ t: 'chat', id, epoch, seq, ev }),
  gone: (id) => r.send({ t: 'unchat', id }),
})

const ts = bin(TAILSCALE)
const pol = policy([`127.0.0.1:${PORT}`, `localhost:${PORT}`, ...(DEV ? ['localhost:5173', '127.0.0.1:5173'] : [])], LOGINS)
const net = link({ exec: ts, port: PORT, serve: SERVE, user: userInfo().username, policy: pol, logins: LOGINS })
await refresh(pol, SERVE, LOGINS, ts)

const app = await build({
  ops: o,
  repo: v.repo,
  cfg: v.cfg,
  projects: v.projects,
  bus: b,
  now,
  policy: pol,
  push: p,
  link: net,
  chat,
  pics: imgs,
  skills: skills(() => HOME),
  room: r,
  who: (ip) => whois(ip, ts),
  web: existsSync(WEB) ? WEB : null,
  vault: v.dir,
  home: HOME,
  log: true,
})

const stop = clock([remind({ posts: v.repo.list, config: v.cfg.load, send: p.send, state: st })])

await app.listen({ host: HOST, port: PORT })
app.log.info({ vault: v.dir, tailnet: [...pol.tailnet] }, 'social.grid pronto')

const boot = () =>
  v.cfg
    .load()
    .then((c) => net.boot(c.phone.link))
    .then(
      (r) => r && r !== 'wait' && app.log.info({ link: r }, 'link na tailnet'),
      (e: unknown) => app.log.error({ msg: e instanceof Error ? e.message : String(e) }, 'link na tailnet'),
    )
void boot()
const tail = setInterval(() => void refresh(pol, SERVE, LOGINS, ts).then(boot), 60_000)
tail.unref()

async function quit() {
  setTimeout(() => process.exit(0), 5_000).unref()
  stop()
  unwatch()
  chat.shutdown()
  r.close()
  await app.close()
  process.exit(0)
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) process.once(sig, () => void quit())
