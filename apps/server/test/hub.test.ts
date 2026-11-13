import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { bus } from '@social-grid/core/bus.ts'
import { PAST, type Ev } from '@social-grid/core/chat.ts'
import { ops } from '@social-grid/core/post/ops.ts'
import { open } from '@social-grid/vault/open.ts'
import { hub } from '../src/chat/hub.ts'
import { pics } from '../src/chat/pics.ts'
import { state } from '../src/state.ts'
import { api, env, home } from './claude.ts'

type Got = { id: string; epoch: string; seq: number | null; ev: Ev }

async function setup() {
  const base = await mkdtemp(join(tmpdir(), 'sg-hub-'))
  const h = await home(base)
  const project = join(h, 'Projects', 'mocha.app')
  await mkdir(project, { recursive: true })
  await writeFile(join(project, 'README.md'), '# mocha\n')
  execFileSync('git', ['init', '-q'], { cwd: project })
  const v = open(join(h, 'SocialGrid'), h)
  await v.cfg.save({ root: join(h, 'Projects') })
  const st = await state(join(base, 'state'))
  const f = await api([
    {
      name: 'mcp__social-grid__criar_post',
      input: { projeto: 'mocha.app', rede: 'instagram', formato: 'feed', titulo: 'Carrossel do mocha', legenda: 'Seu design mora no WhatsApp?', hashtags: ['buildinpublic'] },
    },
  ])
  env(h, f.url)
  const now = () => new Date()
  const got: Got[] = []
  const hubs: ReturnType<typeof hub>[] = []
  const make = () => {
    const x = hub({
      state: st,
      projects: v.projects,
      ctx: { ops: ops({ repo: v.repo, config: v.cfg.load, bus: bus(), now }), repo: v.repo, config: v.cfg.load, projects: v.projects, roots: async () => [project], now },
      vault: v.dir,
      home: h,
      config: v.cfg.load,
      posts: v.repo.list,
      now,
      pics: pics(join(base, 'state', 'pics')),
      on: (id, epoch, seq, ev) => got.push({ id, epoch, seq, ev }),
    })
    hubs.push(x)
    return x
  }
  const end = () => {
    for (const x of hubs) x.shutdown()
    f.close()
  }
  return { got, make, v, end }
}

const until = async (got: Got[], from: number, state = 'idle') => {
  for (let i = 0; i < 600; i++) {
    if (got.slice(from).some((g) => g.ev.k === 'state' && g.ev.state === state)) return
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error('o turno não terminou')
}

test('conversa criada sem texto ganha o título do 1º envio e, depois do servidor reiniciar, reabre com epoch novo sem perder mensagem nem o cartão do post', { timeout: 120_000 }, async () => {
  const { got, make, v, end } = await setup()
  try {
    const a = make()
    const s = await a.start('mocha.app')
    assert.equal(s.title, 'Conversa nova')
    await a.send(s.id, 'Faz um carrossel do mocha')
    await until(got, 0)
    const first = await a.events(s.id, 0)
    const kinds = first.events.map((i) => i.ev.k)
    assert.deepEqual(kinds.filter((k) => k !== 'state'), ['user', 'tool', 'post', 'done', 'text'])
    const made = first.events.find((i) => i.ev.k === 'post')!.ev as { id: string }
    assert.equal((await v.repo.get(made.id))?.project, 'mocha.app')
    await new Promise((r) => setTimeout(r, 200))
    const meta = (await a.list()).find((m) => m.id === s.id)!
    assert.equal(meta.title, 'Faz um carrossel do mocha')
    assert.match(String(meta.sdk), /^[0-9a-f-]{36}$/)
    a.shutdown()
    await until(got, 0, 'closed')
    const b = make()
    assert.equal((await b.list()).find((m) => m.id === s.id)?.title, 'Faz um carrossel do mocha')
    const old = await b.events(s.id, first.events.at(-1)!.seq, first.epoch)
    assert.equal(old.epoch, PAST)
    assert.deepEqual(
      old.events.map((i) => i.ev.k),
      ['user', 'tool', 'post', 'done', 'text'],
    )
    assert.equal((old.events[2]!.ev as { id: string }).id, made.id)

    const mark = got.length
    await b.send(s.id, 'Agora uma versão pro LinkedIn')
    await until(got, mark)
    const fresh = got.slice(mark).filter((g) => g.seq !== null)
    const epoch = fresh[0]!.epoch
    assert.notEqual(epoch, first.epoch)
    assert.ok(fresh.every((g) => g.epoch === epoch))
    assert.ok(fresh[0]!.seq! > old.events.at(-1)!.seq)
    assert.deepEqual(
      fresh.map((g) => g.ev.k),
      ['user', 'state', 'text', 'state'],
    )

    const seen = old.events.at(-1)!.seq
    const reload = await b.events(s.id, seen, PAST)
    assert.equal(reload.epoch, epoch)
    assert.equal(reload.events[0]!.seq, 1)
    assert.ok(reload.events.some((i) => i.ev.k === 'user' && i.ev.text === 'Agora uma versão pro LinkedIn'))
    assert.ok(reload.events.some((i) => i.ev.k === 'post'))
    const same = await b.events(s.id, fresh.at(-2)!.seq!, epoch)
    assert.deepEqual(
      same.events.map((i) => i.seq),
      [fresh.at(-1)!.seq],
    )
  } finally {
    end()
  }
})
