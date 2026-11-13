import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaults, total, type Config } from '../src/plan/config.ts'
import { open, slots } from '../src/plan/slots.ts'
import { post } from './kit.ts'

const config = (): Config => ({
  ...defaults(),
  rules: [
    { net: 'instagram', format: 'feed', days: [0, 2, 4], times: ['12:00'], on: true },
    { net: 'instagram', format: 'story', days: [1, 4], times: ['19:00'], on: true },
    { net: 'linkedin', format: 'post', days: [1, 3], times: ['08:30'], on: true },
  ],
})

const show = (list: ReturnType<typeof slots>) => list.map((s) => `${s.date} ${s.time} ${s.net}/${s.format} ${s.post ?? '-'}`)

test('a semana de 16/11 tem os 7 slots da config e o feed de quarta fica preenchido pelo post agendado', () => {
  const agendado = post({ id: 'migrar-prod-x1y2', date: '2026-11-18', time: '12:00' })
  const list = slots(config(), '2026-11-16', '2026-11-22', [agendado])
  assert.deepEqual(show(list), [
    '2026-11-16 12:00 instagram/feed -',
    '2026-11-17 08:30 linkedin/post -',
    '2026-11-17 19:00 instagram/story -',
    '2026-11-18 12:00 instagram/feed migrar-prod-x1y2',
    '2026-11-19 08:30 linkedin/post -',
    '2026-11-20 12:00 instagram/feed -',
    '2026-11-20 19:00 instagram/story -',
  ])
  assert.equal(open(list).length, 6)
  assert.equal(total(config()), 7)
})

test('carrossel ocupa o slot de feed; post em outra hora, arquivado ou de rede desligada não ocupa', () => {
  const cfg = config()
  const list = slots(cfg, '2026-11-20', '2026-11-20', [
    post({ id: 'carrossel-a1b2', format: 'carrossel', date: '2026-11-20', time: '12:00' }),
    post({ id: 'story-cedo-c3d4', format: 'story', date: '2026-11-20', time: '18:00' }),
    post({ id: 'story-velho-e5f6', format: 'story', date: '2026-11-20', time: '19:00', archived: true }),
  ])
  assert.deepEqual(show(list), ['2026-11-20 12:00 instagram/feed carrossel-a1b2', '2026-11-20 19:00 instagram/story -'])

  cfg.nets.instagram!.on = false
  assert.deepEqual(show(slots(cfg, '2026-11-20', '2026-11-20', [])), [])
})
