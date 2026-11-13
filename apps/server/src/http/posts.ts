import { createWriteStream } from 'node:fs'
import { open, rm } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { range } from '@social-grid/core/day.ts'
import { fail } from '@social-grid/core/fault.ts'
import { MAX_BYTES, mime, sniff } from '@social-grid/core/media.ts'
import { bundle, MAX_CAPTION, type Result } from '@social-grid/core/post/ops.ts'
import { ID, MAX_MEDIA, MAX_TAGS, MAX_TYPE, STATUSES } from '@social-grid/core/post/post.ts'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { UPLOAD } from '../guard.ts'
import type { Deps } from './deps.ts'
import { limiter } from './limit.ts'

const TYPES = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime|webm))$/

const fields = {
  project: z.string().max(100),
  network: z.string().max(32),
  format: z.string().max(32),
  type: z.string().max(MAX_TYPE),
  title: z.string().min(1).max(200),
  caption: z.string().max(MAX_CAPTION),
  hashtags: z.array(z.string().max(80)).max(MAX_TAGS),
  date: z.string().max(10).nullable(),
  time: z.string().max(5).nullable(),
  comment: z.string().max(MAX_CAPTION),
}

const input = z
  .object({ ...fields, project: fields.project.optional(), type: fields.type.optional(), caption: fields.caption.optional(), hashtags: fields.hashtags.optional(), date: fields.date.optional(), time: fields.time.optional(), comment: fields.comment.optional() })
  .strict()

const changes = z
  .object({ ...fields, base: z.string().max(40), media: z.array(z.string().max(100)).max(MAX_MEDIA), archived: z.boolean() })
  .partial()
  .strict()

const list = z
  .object({ de: z.string().max(10).optional(), ate: z.string().max(10).optional(), projeto: z.string().max(100).optional(), status: z.enum(STATUSES).optional(), arquivados: z.literal('1').optional() })
  .strict()

const params = z.object({ id: z.string().regex(ID) })
const media = z.object({ id: z.string().regex(ID), name: z.string().max(100) })
const status = z.object({ to: z.enum(STATUSES), base: z.string().max(40).optional() }).strict()

export const full = (r: Result) => ({ ...r, pack: bundle(r.post) })

async function head(path: string): Promise<Uint8Array> {
  const fh = await open(path, 'r')
  try {
    const buf = Buffer.alloc(32)
    const { bytesRead } = await fh.read(buf, 0, 32, 0)
    return buf.subarray(0, bytesRead)
  } finally {
    await fh.close()
  }
}

export function posts(app: FastifyInstance, d: Deps) {
  const uploads = limiter(30, 60_000)

  app.get('/api/posts', async (req) => {
    const q = list.parse(req.query)
    let all = await d.repo.list()
    if (q.de || q.ate) {
      const [from, to] = range(q.de, q.ate)
      all = all.filter((p) => p.date && p.date >= from && p.date <= to)
    }
    return all
      .filter((p) => q.arquivados || !p.archived)
      .filter((p) => !q.projeto || p.project === q.projeto)
      .filter((p) => !q.status || p.status === q.status)
  })

  app.get('/api/posts/:id', async (req) => full(await d.ops.get(params.parse(req.params).id)))

  app.post('/api/posts', async (req, reply) => {
    const r = await d.ops.create(input.parse(req.body))
    reply.code(201)
    return full(r)
  })

  app.patch('/api/posts/:id', async (req) => {
    const { base, ...c } = changes.parse(req.body)
    return full(await d.ops.patch(params.parse(req.params).id, c, base))
  })

  app.delete('/api/posts/:id', async (req) => {
    await d.ops.remove(params.parse(req.params).id)
    return { ok: true }
  })

  app.post('/api/posts/:id/status', async (req) => {
    const b = status.parse(req.body)
    return full(await d.ops.move(params.parse(req.params).id, b.to, b.base))
  })

  app.post(UPLOAD, async (req, reply) => {
    uploads()
    const { id } = params.parse(req.params)
    await d.ops.get(id)
    const file = await req.file({ limits: { fileSize: MAX_BYTES, files: 1, fields: 0, parts: 1 } })
    if (!file) fail('invalid', 'nenhum arquivo')
    if (!TYPES.test(file.mimetype)) {
      file.file.resume()
      fail('invalid', 'só imagem (jpg, png, webp, gif) ou vídeo (mp4, mov, webm)')
    }
    const tmp = await d.repo.temp(id)
    try {
      await pipeline(file.file, createWriteStream(tmp, { flags: 'wx', mode: 0o644 }))
      if (file.file.truncated) fail('too_large', 'arquivo maior que 100 MB')
      const ext = sniff(await head(tmp)) ?? fail('invalid', 'o conteúdo não é imagem nem vídeo aceito')
      const r = await d.ops.attach(id, tmp, ext, true)
      reply.code(201)
      return { ...full(r), name: r.name }
    } finally {
      await rm(tmp, { force: true })
    }
  })

  app.get('/api/posts/:id/media/:name', async (req, reply) => {
    const { id, name } = media.parse(req.params)
    const path = await d.repo.file(id, name)
    if (!path) return reply.code(404).send({ error: 'not_found' })
    reply.header('content-disposition', `inline; filename="${name}"`)
    reply.header('cache-control', 'private, max-age=31536000, immutable')
    return reply.type(mime(name)).sendFile(name, path.slice(0, -name.length - 1), { contentType: false })
  })
}
