import { fail } from '@social-grid/core/fault.ts'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Deps } from './deps.ts'
import { limiter } from './limit.ts'

const endpoint = z.object({ endpoint: z.string().max(1024) }).strict()

export function push(app: FastifyInstance, d: Deps) {
  const subs = limiter(10, 60_000)
  const p = () => d.push ?? fail('busy', 'avisos indisponíveis')

  app.get('/api/push', async () => ({ key: p().key(), count: p().count() }))

  app.post('/api/push/subscribe', async (req) => {
    subs()
    await p().subscribe(z.object({ sub: z.unknown() }).strict().parse(req.body).sub)
    return { ok: true, count: p().count() }
  })

  app.post('/api/push/unsubscribe', async (req) => {
    await p().unsubscribe(endpoint.parse(req.body).endpoint)
    return { ok: true, count: p().count() }
  })

  app.post('/api/push/test', async () => {
    subs()
    await p().send({ key: `test:${Date.now()}`, title: 'social.grid', body: 'Avisos ligados neste aparelho.', url: '/hoje' })
    return { ok: true }
  })
}
