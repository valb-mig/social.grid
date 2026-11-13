import { fail } from '@social-grid/core/fault.ts'
import { mime } from '@social-grid/core/media.ts'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { MAX_TEXT } from '../chat/hub.ts'
import { MAX_PIC, MAX_PICS, NAME } from '../chat/pics.ts'
import { PICS } from '../guard.ts'
import type { Deps } from './deps.ts'
import { limiter } from './limit.ts'

const params = z.object({ id: z.string().max(40) })
const images = z.array(z.string().regex(NAME)).max(MAX_PICS).optional()
const start = z.object({ project: z.string().max(100), text: z.string().max(MAX_TEXT).optional(), images }).strict()
const send = z.object({ text: z.string().max(MAX_TEXT), images }).strict()
const after = z.object({ after: z.coerce.number().int().min(0).default(0), epoch: z.string().max(40).optional() }).strict()
const pic = z.object({ name: z.string().regex(NAME) })

export function chat(app: FastifyInstance, d: Deps) {
  const turns = limiter(20, 60_000)
  const uploads = limiter(30, 60_000)
  const hub = () => d.chat ?? fail('busy', 'chat indisponível')
  const store = () => d.pics ?? fail('busy', 'chat indisponível')

  app.get('/api/chat', async () => hub().list())

  app.post('/api/chat', async (req, reply) => {
    turns()
    const b = start.parse(req.body)
    reply.code(201)
    return hub().start(b.project, b.text, b.images)
  })

  app.get('/api/chat/:id', async (req) => {
    const q = after.parse(req.query)
    return hub().events(params.parse(req.params).id, q.after, q.epoch)
  })

  app.post('/api/chat/:id/send', async (req, reply) => {
    turns()
    const b = send.parse(req.body)
    await hub().send(params.parse(req.params).id, b.text, b.images)
    reply.code(202)
    return { ok: true }
  })

  app.post('/api/chat/:id/stop', async (req) => {
    await hub().stop(params.parse(req.params).id)
    return { ok: true }
  })

  app.post(PICS, async (req, reply) => {
    uploads()
    const file = await req.file({ limits: { fileSize: MAX_PIC, files: 1, fields: 0, parts: 1 } })
    if (!file) fail('invalid', 'nenhum arquivo')
    const data = await file.toBuffer()
    if (file.file.truncated) fail('too_large', 'imagem maior que 5 MB')
    reply.code(201)
    return { name: await store().save(data) }
  })

  app.get('/api/chat/images/:name', async (req, reply) => {
    const { name } = pic.parse(req.params)
    const path = await store().file(name)
    if (!path) return reply.code(404).send({ error: 'not_found' })
    reply.header('cache-control', 'private, max-age=31536000, immutable')
    return reply.type(mime(name)).sendFile(name, path.slice(0, -name.length - 1), { contentType: false })
  })
}
