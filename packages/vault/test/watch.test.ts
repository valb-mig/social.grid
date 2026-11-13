import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { bus } from '@social-grid/core/bus.ts'
import { ops } from '@social-grid/core/post/ops.ts'
import { open } from '../src/open.ts'
import { watch } from '../src/watch.ts'

const settle = () => new Promise((r) => setTimeout(r, 450))

async function setup() {
  const base = await mkdtemp(join(tmpdir(), 'sg-watch-'))
  const v = open(join(base, 'vault'), join(base, 'home'))
  await mkdir(v.dir, { recursive: true })
  const seen = bus()
  const posts: string[] = []
  let configs = 0
  seen.on('post', (e) => posts.push(e.id))
  seen.on('config', () => configs++)
  const o = ops({ repo: v.repo, config: v.cfg.load, bus: bus(), now: () => new Date() })
  const stop = await watch(v.dir, seen, { post: v.repo.mine, config: v.cfg.mine }, 100)
  return { v, o, posts, configs: () => configs, stop }
}

test('edição à mão no post.md e pasta nova emitem 1 evento cada; escrita do próprio app não duplica', async () => {
  const { v, o, posts, stop } = await setup()
  try {
    const { post } = await o.create({ network: 'instagram', format: 'feed', title: 'Carrossel do mocha', caption: 'Gancho' })
    await o.patch(post.id, { caption: 'Gancho novo' })
    await settle()
    assert.deepEqual(posts, [])

    const md = join(v.repo.dir, post.id, 'post.md')
    await writeFile(md, (await readFile(md, 'utf8')).replace('Gancho novo', 'Gancho editado no Obsidian'))
    await settle()
    assert.deepEqual(posts, [post.id])
    assert.equal((await v.repo.get(post.id))?.caption, 'Gancho editado no Obsidian')

    const folder = join(v.repo.dir, 'ideia-solta-m4n5')
    await mkdir(folder)
    await writeFile(join(folder, 'post.md'), '---\ntitle: Ideia solta\n---\nTexto.\n')
    await writeFile(join(folder, '.post.md.1234.tmp'), 'lixo')
    await settle()
    assert.deepEqual(posts, [post.id, 'ideia-solta-m4n5'])
  } finally {
    stop()
  }
})

test('config.json salvo pelo app não emite; editado à mão emite 1 vez', async () => {
  const { v, configs, stop } = await setup()
  try {
    const cfg = await v.cfg.save({ model: 'haiku' })
    await settle()
    assert.equal(configs(), 0)
    await writeFile(v.cfg.file, JSON.stringify({ ...cfg, model: 'sonnet' }))
    await settle()
    assert.equal(configs(), 1)
    assert.equal((await v.cfg.load()).model, 'sonnet')
  } finally {
    stop()
  }
})
