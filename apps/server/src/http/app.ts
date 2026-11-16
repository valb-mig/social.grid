import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import websocket from '@fastify/websocket'
import { Fault, type Code } from '@social-grid/core/fault.ts'
import { MAX_BYTES } from '@social-grid/core/media.ts'
import Fastify, { LogController, type FastifyInstance } from 'fastify'
import { z } from 'zod'
import { headers, hook } from '../guard.ts'
import { socket } from '../ws.ts'
import { chat } from './chat.ts'
import { config } from './config.ts'
import type { Deps } from './deps.ts'
import { link } from './link.ts'
import { posts } from './posts.ts'
import { projects } from './projects.ts'
import { push } from './push.ts'
import { skills } from './skills.ts'

const CODES: Record<Code, number> = { invalid: 400, not_found: 404, conflict: 409, refused: 422, too_large: 413, busy: 429 }
const LIMITS: Record<string, number> = { FST_REQ_FILE_TOO_LARGE: 413, FST_FILES_LIMIT: 413, FST_PARTS_LIMIT: 413, FST_FIELDS_LIMIT: 413, FST_INVALID_MULTIPART_CONTENT_TYPE: 415 }

export async function build(d: Deps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: d.log ? { level: 'info' } : false,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 1 << 20,
  })

  app.addHook('onRequest', hook(d.policy))
  app.addHook('onSend', headers)

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof Fault) return reply.code(CODES[err.code]).send({ error: err.code, message: err.message })
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'invalid', message: err.issues.map((i) => `${i.path.join('.') || 'corpo'}: ${i.message}`).join('; ') })
    }
    const e = err as { code?: string; statusCode?: number; message?: string }
    if (e.code && LIMITS[e.code]) return reply.code(LIMITS[e.code]!).send({ error: 'too_large', message: 'arquivo fora do limite' })
    if (e.statusCode && e.statusCode >= 400 && e.statusCode < 500) return reply.code(e.statusCode).send({ error: 'invalid', message: e.message ?? '' })
    req.log.error({ code: e.code, msg: e.message })
    return reply.code(500).send({ error: 'internal' })
  })

  await app.register(websocket, { options: { maxPayload: 4096 } })
  await app.register(multipart, { limits: { fileSize: MAX_BYTES, files: 1, fields: 0, parts: 1, fieldSize: 1024, headerPairs: 50 } })
  await app.register(fastifyStatic, {
    root: d.web ?? d.vault,
    serve: !!d.web,
    setHeaders: (reply, path) => {
      if (d.web && path.startsWith(d.web)) reply.header('cache-control', path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
    },
  })

  posts(app, d)
  projects(app, d)
  config(app, d)
  skills(app, d)
  push(app, d)
  link(app, d)
  chat(app, d)
  socket(app, d.room, d.bus, d.who)

  app.setNotFoundHandler((req, reply) => {
    const path = req.url.split('?')[0] ?? ''
    if (d.web && req.method === 'GET' && !path.startsWith('/api/') && path !== '/ws') {
      return reply.header('cache-control', 'no-cache').sendFile('index.html', d.web)
    }
    return reply.code(404).send({ error: 'not_found' })
  })

  return app
}
