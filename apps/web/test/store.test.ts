import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Ev, Item, Log } from '@social-grid/core/chat.ts'

const asked: string[] = []
let server: { epoch: string; events: Item[]; state: Log['state'] } = { epoch: 'a1', events: [], state: 'idle' }

globalThis.fetch = (async (url: string) => {
  asked.push(url)
  const q = new URL(url, 'http://pc').searchParams
  const after = Number(q.get('after') ?? 0)
  const same = q.get('epoch') === server.epoch
  const events = same ? server.events.filter((i) => i.seq > after) : server.events
  return new Response(JSON.stringify({ state: server.state, epoch: server.epoch, events }), { status: 200 })
}) as typeof fetch

const { useStore } = await import('../src/lib/store.ts')

const items = (...evs: Ev[]): Item[] => evs.map((ev, i) => ({ seq: i + 1, ev }))
const settle = () => new Promise((r) => setTimeout(r, 20))
const texts = (id: string) => useStore.getState().chats[id]!.items.map((i) => (i.ev.k === 'user' || i.ev.k === 'text' ? i.ev.text : i.ev.k))

test('celular recebe evento de conversa que não abriu: ignora e, ao abrir, carrega a conversa do começo', async () => {
  const id = 'c1'
  server = { epoch: 'a1', state: 'idle', events: items({ k: 'user', text: 'faz um post' }, { k: 'text', text: 'rascunho 1' }, { k: 'text', text: 'rascunho 2' }) }
  useStore.getState().event(id, 'a1', 3, { k: 'text', text: 'rascunho 2' })
  assert.equal(useStore.getState().chats[id], undefined)
  await useStore.getState().loadChat(id)
  assert.match(asked.at(-1)!, /after=0$/)
  assert.deepEqual(texts(id), ['faz um post', 'rascunho 1', 'rascunho 2'])
})

test('servidor reiniciou e a conversa reabriu com seq menor: o epoch novo recarrega tudo e nada se perde', async () => {
  const id = 'c2'
  server = {
    epoch: 'a1',
    state: 'idle',
    events: items({ k: 'user', text: 'oi' }, { k: 'state', state: 'running' }, { k: 'text', text: 'olá' }, { k: 'state', state: 'idle' }),
  }
  await useStore.getState().loadChat(id)
  assert.equal(useStore.getState().chats[id]!.seq, 4)

  server = { epoch: 'b2', state: 'running', events: items({ k: 'user', text: 'oi' }, { k: 'text', text: 'olá' }, { k: 'user', text: 'mais curto' }) }
  useStore.getState().event(id, 'b2', 3, { k: 'user', text: 'mais curto' })
  await settle()
  assert.match(asked.at(-1)!, /after=4&epoch=a1$/)
  assert.equal(useStore.getState().chats[id]!.epoch, 'b2')
  assert.deepEqual(texts(id), ['oi', 'olá', 'mais curto'])

  useStore.getState().event(id, 'b2', null, { k: 'delta', text: 'tá ' })
  useStore.getState().event(id, 'b2', null, { k: 'delta', text: 'aqui' })
  assert.equal(useStore.getState().chats[id]!.stream, 'tá aqui')
  useStore.getState().event(id, 'b2', 4, { k: 'text', text: 'tá aqui' })
  useStore.getState().event(id, 'b2', 4, { k: 'text', text: 'tá aqui' })
  useStore.getState().event(id, 'a1', 5, { k: 'state', state: 'closed' })
  await settle()
  assert.deepEqual(texts(id), ['oi', 'olá', 'mais curto', 'tá aqui'])
  assert.equal(useStore.getState().chats[id]!.stream, '')
})

test('post criado pelo chat acende o brilho na agenda mesmo sem a conversa aberta', () => {
  useStore.getState().event('c3', 'z9', 7, { k: 'post', id: 'carrossel-do-mocha-a1b2' })
  assert.ok(useStore.getState().fresh['carrossel-do-mocha-a1b2'])
})
