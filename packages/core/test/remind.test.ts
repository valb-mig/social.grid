import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaults } from '../src/plan/config.ts'
import { due } from '../src/plan/remind.ts'
import { at, post } from './kit.ts'

const pronto = post({ id: 'carrossel-mocha-a1b2', title: 'Carrossel do mocha', status: 'ready', date: '2026-11-13', time: '12:00' })
const rascunho = post({ id: 'story-editr-c3d4', title: 'Story de bastidores', status: 'draft', date: '2026-11-13', time: '19:00' })

test('post pronto às 12:00 avisa às 11:45 e não repete às 11:46', () => {
  const sent = new Set<string>()
  const first = due([pronto], defaults(), at('2026-11-13T11:45:00'), sent)
  assert.equal(first.length, 1)
  assert.equal(first[0]!.body, 'Em 15 min: Carrossel do mocha no Instagram. Tudo pronto pra colar.')
  assert.equal(first[0]!.url, '/post/carrossel-mocha-a1b2')
  for (const n of first) sent.add(n.key)
  assert.equal(due([pronto], defaults(), at('2026-11-13T11:46:00'), sent).length, 0)
})

test('janela do aviso: antes dela nada, e um PC que acordou às 11:52 ainda avisa', () => {
  assert.equal(due([pronto], defaults(), at('2026-11-13T11:44:00'), new Set()).length, 0)
  assert.equal(due([pronto], defaults(), at('2026-11-13T11:52:00'), new Set()).length, 1)
  assert.equal(due([pronto], defaults(), at('2026-11-13T12:00:00'), new Set()).length, 0)
})

test('rascunho do dia avisa a partir das 09:00, uma vez', () => {
  assert.equal(due([rascunho], defaults(), at('2026-11-13T08:59:00'), new Set()).length, 0)
  const n = due([rascunho], defaults(), at('2026-11-13T09:00:00'), new Set())
  assert.equal(n.length, 1)
  assert.match(n[0]!.body, /Story de bastidores \(Instagram às 19:00\) ainda é rascunho/)
  assert.equal(due([rascunho], defaults(), at('2026-11-13T09:01:00'), new Set([n[0]!.key])).length, 0)
})

test('avisos desligados na config não disparam', () => {
  const cfg = defaults()
  cfg.push.ready = false
  cfg.push.draft = false
  assert.equal(due([pronto, rascunho], cfg, at('2026-11-13T11:45:00'), new Set()).length, 0)
})

test('rascunho das 08:00 avisa às 07:45, antes do horário fixo das 09:00, e não avisa depois que a hora passou', () => {
  const cedo = post({ id: 'linkedin-cedo-e5f6', title: 'Post das oito', network: 'linkedin', format: 'post', status: 'draft', date: '2026-11-13', time: '08:00' })
  assert.equal(due([cedo], defaults(), at('2026-11-13T07:44:00'), new Set()).length, 0)
  const n = due([cedo], defaults(), at('2026-11-13T07:45:00'), new Set())
  assert.equal(n.length, 1)
  assert.equal(n[0]!.body, 'Post das oito (LinkedIn às 08:00) ainda é rascunho.')
  assert.equal(due([cedo], defaults(), at('2026-11-13T08:00:00'), new Set()).length, 0)
  assert.equal(due([cedo], defaults(), at('2026-11-13T09:00:00'), new Set()).length, 0)
})

test('rascunho sem hora avisa no horário da config e só no dia dele', () => {
  const solto = post({ id: 'sem-hora-g7h8', title: 'Rascunho sem hora', status: 'draft', date: '2026-11-13', time: null })
  assert.equal(due([solto], defaults(), at('2026-11-13T08:59:00'), new Set()).length, 0)
  assert.equal(due([solto], defaults(), at('2026-11-13T09:00:00'), new Set()).length, 1)
  assert.equal(due([solto], defaults(), at('2026-11-14T09:00:00'), new Set()).length, 0)
  assert.equal(due([post({ ...solto, date: null })], defaults(), at('2026-11-13T09:00:00'), new Set()).length, 0)
})

test('post pronto às 00:10 avisa às 23:55 da véspera, e o rascunho dele também', () => {
  const meia = post({ id: 'meia-noite-i9j0', title: 'Lançamento à meia-noite', status: 'ready', date: '2026-11-14', time: '00:10' })
  assert.equal(due([meia], defaults(), at('2026-11-13T23:54:00'), new Set()).length, 0)
  const n = due([meia], defaults(), at('2026-11-13T23:55:00'), new Set())
  assert.equal(n.length, 1)
  assert.equal(n[0]!.body, 'Em 15 min: Lançamento à meia-noite no Instagram. Tudo pronto pra colar.')
  assert.equal(due([meia], defaults(), at('2026-11-14T00:05:00'), new Set()).length, 1)
  assert.equal(due([meia], defaults(), at('2026-11-14T00:10:00'), new Set()).length, 0)
  const rascunho = { ...meia, status: 'draft' as const }
  assert.equal(due([rascunho], defaults(), at('2026-11-13T23:55:00'), new Set())[0]?.key, 'draft:meia-noite-i9j0:2026-11-14')
})
