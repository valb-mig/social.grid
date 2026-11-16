import { fail } from '@social-grid/core/fault.ts'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { read } from '../guard.ts'
import { Block, type Id } from '../link.ts'
import type { Deps } from './deps.ts'
import { limiter } from './limit.ts'

const body = z.object({ on: z.boolean() }).strict()

const CODES: Partial<Record<Id, number>> = { missing: 503, stopped: 503, dns: 422, https: 422, serve: 422, busy: 409, operator: 403, failed: 502 }

export function link(app: FastifyInstance, d: Deps) {
  const reads = limiter(120, 60_000)
  const writes = limiter(10, 60_000)
  const net = () => d.link ?? fail('busy', 'o link da tailnet não está disponível')
  const local = (req: FastifyRequest) => {
    const r = read(req)
    return d.policy.hosts.has(r.host) && !r.proxied
  }
  const view = async (req: FastifyRequest) => {
    const want = (await d.cfg.load()).phone.link
    return { ...(await net().check(want)), want, local: local(req) }
  }

  app.get('/api/link', async (req) => {
    reads()
    return view(req)
  })

  app.post('/api/link', async (req, reply) => {
    if (!local(req)) return reply.code(403).send({ error: 'local_only', message: 'Só o PC liga ou desliga o link da tailnet. Abra o app no próprio PC.' })
    writes()
    const { on } = body.parse(req.body)
    const l = net()
    const cur = await d.cfg.load()
    if (cur.phone.link !== on) {
      await d.cfg.save({ ...cur, phone: { ...cur.phone, link: on } })
      d.bus.emit('config', {})
    }
    try {
      await (on ? l.on() : l.off())
    } catch (e) {
      if (!(e instanceof Block)) throw e
      return reply.code(CODES[e.todo.id] ?? 502).send({ error: e.todo.id, message: e.todo.text, ...(e.todo.cmd ? { cmd: e.todo.cmd } : {}) })
    }
    return view(req)
  })
}
