import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { MAX, type Doc } from '../skills/skills.ts'
import type { Deps } from './deps.ts'
import { limiter } from './limit.ts'

const params = z.object({ kind: z.enum(['skill', 'agent']), name: z.string().max(64) })
const query = z.object({ file: z.string().max(200) }).strict()
const body = z.object({ file: z.string().max(200), body: z.string().max(MAX) }).strict()

export function skills(app: FastifyInstance, d: Deps) {
  const writes = limiter(60, 60_000)
  const show = (doc: Doc) => ({ ...doc, path: doc.path.startsWith(d.home) ? `~${doc.path.slice(d.home.length)}` : doc.path })

  app.get('/api/skills', async () => d.skills.list(await d.cfg.load()))

  app.get('/api/skills/:kind/:name', async (req) => {
    const p = params.parse(req.params)
    return show(await d.skills.read(p.kind, p.name, query.parse(req.query).file, await d.cfg.load()))
  })

  app.put('/api/skills/:kind/:name', async (req) => {
    writes()
    const p = params.parse(req.params)
    const b = body.parse(req.body)
    return show(await d.skills.write(p.kind, p.name, b.file, b.body, await d.cfg.load()))
  })
}
