import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { defaults } from '@social-grid/core/plan/config.ts'
import type { Notice } from '@social-grid/core/plan/remind.ts'
import { make, type Post } from '@social-grid/core/post/post.ts'
import { clock } from '../src/clock.ts'
import { remind } from '../src/push/remind.ts'
import { state } from '../src/state.ts'

const at = (iso: string) => new Date(iso)
const post = (p: Partial<Post>): Post => ({ ...make({ network: 'instagram', format: 'feed', title: 'Carrossel do mocha' }, at('2026-11-12T10:00:00')), id: 'carrossel-do-mocha-a1b2', ...p })

const busy = new Set<Promise<unknown>>()

const track = (fn: (now: Date) => Promise<unknown>) => (now: Date) => {
  const run = fn(now)
  busy.add(run)
  void run.catch(() => undefined).finally(() => busy.delete(run))
  return run
}

async function flush(t: TestContext, ms: number) {
  for (let i = 0; i < ms / 500; i++) {
    t.mock.timers.tick(500)
    await Promise.allSettled([...busy])
    await new Promise((r) => setImmediate(r))
  }
}

test('relógio de verdade: liga às 11:44:30, roda na virada de cada minuto, avisa o post das 12:00 às 11:45 uma vez e para no stop', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: at('2026-11-13T11:44:30') })
  const st = await state(await mkdtemp(join(tmpdir(), 'sg-clock-')))
  const sent: { at: string; n: Notice }[] = []
  const ticks: string[] = []
  const tick = remind({
    posts: async () => [post({ status: 'ready', date: '2026-11-13', time: '12:00' })],
    config: async () => defaults(),
    send: async (n) => void sent.push({ at: new Date().toTimeString().slice(0, 8), n }),
    state: st,
  })
  const stop = clock([
    track(async (now) => {
      ticks.push(now.toTimeString().slice(0, 8))
      await tick(now)
    }),
  ])

  await flush(t, 29_000)
  assert.deepEqual(ticks, [])
  await flush(t, 2_000)
  assert.deepEqual(ticks, ['11:45:00'])
  assert.deepEqual(sent.map((s) => [s.at, s.n.body]), [['11:45:00', 'Em 15 min: Carrossel do mocha no Instagram. Tudo pronto pra colar.']])

  await flush(t, 120_000)
  assert.deepEqual(ticks, ['11:45:00', '11:46:00', '11:47:00'])
  assert.equal(sent.length, 1)

  stop()
  await flush(t, 180_000)
  assert.equal(ticks.length, 3)
})

test('tick que falha não derruba o relógio: o minuto seguinte roda', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: at('2026-11-13T09:00:10') })
  let calls = 0
  const stop = clock([
    track(async () => {
      calls++
      throw new Error('vault fora do ar')
    }),
  ])
  await flush(t, 120_000)
  stop()
  assert.equal(calls, 2)
})

test('falha no envio do push não faz o aviso repetir no minuto seguinte', async () => {
  const st = await state(await mkdtemp(join(tmpdir(), 'sg-state-')))
  let calls = 0
  const tick = remind({
    posts: async () => [post({ status: 'ready', date: '2026-11-13', time: '12:00' })],
    config: async () => defaults(),
    send: async () => {
      calls++
      throw new Error('offline')
    },
    state: st,
  })
  await tick(at('2026-11-13T11:50:00'))
  await tick(at('2026-11-13T11:51:00'))
  assert.equal(calls, 1)
  assert.equal(Object.keys(await st.read<Record<string, string>>('sent.json', {})).length, 1)
})
