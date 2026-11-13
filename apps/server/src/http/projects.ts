import { createReadStream } from 'node:fs'
import { PID, stats } from '@social-grid/core/project/project.ts'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { SANDBOX } from '../guard.ts'
import type { Deps } from './deps.ts'

const params = z.object({ id: z.string().regex(PID) })

export function projects(app: FastifyInstance, d: Deps) {
  app.get('/api/projects', async () => {
    const [list, posts] = await Promise.all([d.projects.list(), d.repo.list()])
    return list.map((p) => ({ ...p, stats: stats(p, posts) }))
  })

  app.get('/api/projects/:id/icon', async (req, reply) => {
    const icon = await d.projects.icon(params.parse(req.params).id)
    if (!icon) return reply.code(404).send({ error: 'not_found' })
    reply.header('content-security-policy', SANDBOX)
    reply.header('cache-control', 'private, max-age=300')
    return reply.type(icon.type).send(createReadStream(icon.file))
  })
}
