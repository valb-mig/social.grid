import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Fault } from '../src/fault.ts'
import { instagram } from '../src/network/instagram.ts'
import { linkedin } from '../src/network/linkedin.ts'
import { errors } from '../src/network/net.ts'
import { move } from '../src/post/status.ts'
import type { Post } from '../src/post/post.ts'
import { at, many, post } from './kit.ts'

const refused = (fn: () => unknown) => assert.throws(fn, (e) => e instanceof Fault && e.code === 'refused')
const to = (p: Post, s: Post['status'], now = at('2026-11-13T11:00:00')) => move(p, s, { now, issues: p.network === 'linkedin' ? linkedin.check(p) : instagram.check(p) })

test('post de Instagram com 31 hashtags não fica pronto; com 30 fica; pronto -> postado grava a hora; postado não volta a rascunho', () => {
  const p = post({ media: ['m-0a1b2c3d4e.jpg'], hashtags: many(31) })
  refused(() => to(p, 'ready'))

  const ready = to({ ...p, hashtags: p.hashtags.slice(1) }, 'ready')
  assert.equal(ready.status, 'ready')

  const posted = to(ready, 'posted', at('2026-11-13T12:02:00'))
  assert.equal(posted.status, 'posted')
  assert.equal(posted.postedAt, at('2026-11-13T12:02:00').toISOString())

  refused(() => to(posted, 'draft'))
  assert.equal(to(posted, 'ready', at('2026-11-13T20:00:00')).status, 'ready')
  refused(() => to(posted, 'ready', at('2026-11-14T08:00:00')))
})

test('rascunho não pula direto para postado', () => {
  refused(() => to(post({ media: ['m-0a1b2c3d4e.jpg'] }), 'posted'))
})

test('carrossel com 1 mídia e LinkedIn com 3100 letras não ficam prontos; link no corpo do LinkedIn vira aviso', () => {
  const carrossel = post({ format: 'carrossel', media: ['m-0a1b2c3d4e.jpg'] })
  assert.deepEqual(errors(instagram.check(carrossel)).map((i) => i.code), ['media_min'])
  refused(() => to(carrossel, 'ready'))
  assert.equal(to({ ...carrossel, media: ['m-0a1b2c3d4e.jpg', 'm-1a1b2c3d4e.jpg'] }, 'ready').status, 'ready')

  const longo = post({ network: 'linkedin', format: 'post', caption: 'a'.repeat(3100), hashtags: many(3) })
  assert.deepEqual(errors(linkedin.check(longo)).map((i) => i.code), ['length'])
  refused(() => to(longo, 'ready'))

  const comLink = post({ network: 'linkedin', format: 'post', caption: 'Lancei o mocha.\n\nCódigo em https://github.com/valb-mig/mocha', hashtags: many(4) })
  const issues = linkedin.check(comLink)
  assert.ok(issues.some((i) => i.level === 'warn' && i.code === 'link'))
  assert.equal(to(comLink, 'ready').status, 'ready')
})

test('reels só aceita vídeo e story ignora legenda', () => {
  assert.ok(errors(instagram.check(post({ format: 'reels', media: ['m-0a1b2c3d4e.jpg'] }))).some((i) => i.code === 'media_video'))
  assert.deepEqual(errors(instagram.check(post({ format: 'reels', media: ['m-0a1b2c3d4e.mp4'] }))), [])
  assert.deepEqual(errors(instagram.check(post({ format: 'story', caption: '', media: ['m-0a1b2c3d4e.jpg'] }))), [])
})
