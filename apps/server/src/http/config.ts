import { range } from '@social-grid/core/day.ts'
import { slots } from '@social-grid/core/plan/slots.ts'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Deps } from './deps.ts'
import { limiter } from './limit.ts'

const span = z.object({ de: z.string().max(10), ate: z.string().max(10) }).strict()

export function config(app: FastifyInstance, d: Deps) {
  const writes = limiter(60, 60_000)

  app.get('/api/config', async () => ({ config: await d.cfg.load(), root: await d.cfg.projects() }))

  app.put('/api/config', async (req) => {
    writes()
    const cfg = await d.cfg.save(req.body)
    d.bus.emit('config', {})
    return { config: cfg, root: await d.cfg.projects() }
  })

  app.get('/api/slots', async (req) => {
    const q = span.parse(req.query)
    const [from, to] = range(q.de, q.ate)
    const [cfg, posts] = await Promise.all([d.cfg.load(), d.repo.list()])
    return slots(cfg, from, to, posts)
  })
}
