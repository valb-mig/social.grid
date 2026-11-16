import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shape } from '../src/network/index.ts'
import { errors } from '../src/network/net.ts'
import { tiktok } from '../src/network/tiktok.ts'
import { youtube } from '../src/network/youtube.ts'
import { defaults, merge, schema } from '../src/plan/config.ts'
import { many, post } from './kit.ts'

const codes = (list: { code: string }[]) => list.map((i) => i.code)

test('TikTok: vídeo só aceita vídeo, fotos só aceita imagem, e legenda vazia é aviso', () => {
  assert.deepEqual(codes(errors(tiktok.check(post({ network: 'tiktok', format: 'video', media: ['m-0a1b2c3d4e.jpg'] })))), ['media_video'])
  assert.deepEqual(codes(errors(tiktok.check(post({ network: 'tiktok', format: 'fotos', media: ['m-0a1b2c3d4e.jpg', 'm-1a1b2c3d4e.mp4'] })))), ['media_image'])
  assert.deepEqual(codes(errors(tiktok.check(post({ network: 'tiktok', format: 'fotos', media: ['m-0a1b2c3d4e.jpg'], hashtags: many(40) })))), [])

  const mudo = tiktok.check(post({ network: 'tiktok', format: 'video', caption: '', media: ['m-0a1b2c3d4e.mp4'] }))
  assert.deepEqual(errors(mudo), [])
  assert.ok(mudo.some((i) => i.level === 'warn' && i.code === 'caption'))
})

test('TikTok: link na legenda vira aviso de bio; legenda e hashtags cabem em 4000 letras', () => {
  const link = tiktok.check(post({ network: 'tiktok', format: 'video', caption: 'Código em github.com/x e www.valb.dev', media: ['m-0a1b2c3d4e.mp4'] }))
  assert.ok(link.some((i) => i.level === 'warn' && i.code === 'link'))
  const cabe = post({ network: 'tiktok', format: 'video', caption: 'a'.repeat(4000), media: ['m-0a1b2c3d4e.mp4'] })
  assert.deepEqual(errors(tiktok.check(cabe)), [])
  assert.deepEqual(codes(errors(tiktok.check({ ...cabe, hashtags: ['a'] }))), ['length'])
})

test('YouTube vídeo: 1 vídeo e capa opcional; sem vídeo, 2 vídeos ou 2 capas não ficam prontos', () => {
  const v = (media: string[]) => codes(errors(youtube.check(post({ network: 'youtube', format: 'video', media, hashtags: many(3) }))))
  assert.deepEqual(v(['m-0a1b2c3d4e.mp4']), [])
  assert.deepEqual(v(['m-0a1b2c3d4e.png', 'm-1a1b2c3d4e.mp4']), [])
  assert.deepEqual(v([]), ['media_video'])
  assert.deepEqual(v(['m-0a1b2c3d4e.png']), ['media_video'])
  assert.deepEqual(v(['m-0a1b2c3d4e.mp4', 'm-1a1b2c3d4e.mp4']), ['media_max'])
  assert.deepEqual(v(['m-0a1b2c3d4e.mp4', 'm-1a1b2c3d4e.png', 'm-2a1b2c3d4e.png']), ['media_max'])
})

test('YouTube: título do vídeo até 100 letras e sem < nem >; 16 hashtags é erro; comunidade pede texto e só imagem', () => {
  const shorts = (i: Parameters<typeof post>[0]) => codes(errors(youtube.check(post({ network: 'youtube', format: 'shorts', media: ['m-0a1b2c3d4e.mp4'], ...i }))))
  assert.deepEqual(shorts({ title: 'a'.repeat(100) }), [])
  assert.deepEqual(shorts({ title: 'a'.repeat(101) }), ['title'])
  assert.deepEqual(shorts({ title: 'Array<string> no TypeScript' }), ['title_char'])
  assert.deepEqual(shorts({ hashtags: many(15) }), [])
  assert.deepEqual(shorts({ hashtags: many(16) }), ['tags_max'])
  assert.deepEqual(shorts({ caption: '' }), [])

  const com = (i: Parameters<typeof post>[0]) => codes(errors(youtube.check(post({ network: 'youtube', format: 'comunidade', title: 'a'.repeat(140), ...i }))))
  assert.deepEqual(com({}), [])
  assert.deepEqual(com({ caption: ' ' }), ['caption'])
  assert.deepEqual(com({ media: ['m-0a1b2c3d4e.mp4'] }), ['media_image'])
  assert.deepEqual(com({ media: Array.from({ length: 11 }, (_, k) => `m-${k}a1b2c3d4e.png`) }), ['media_max'])
})

test('a arte sai no formato da rede: capa do YouTube paisagem, fotos do TikTok vertical, o resto retrato', () => {
  assert.equal(shape('youtube', 'video'), 'paisagem')
  assert.equal(shape('youtube', 'comunidade'), 'quadrado')
  assert.equal(shape('tiktok', 'fotos'), 'vertical')
  assert.equal(shape('instagram', 'story'), 'vertical')
  assert.equal(shape('linkedin', 'artigo'), 'paisagem')
  assert.equal(shape('instagram', 'feed'), 'retrato')
  assert.equal(shape('rede-x', 'feed'), 'retrato')
})

test('config antiga, só com Instagram e LinkedIn, ganha TikTok e YouTube ligados e sem slot', () => {
  const old = {
    nets: { instagram: { on: true, handle: '@valb.dev' }, linkedin: { on: false, handle: 'in/valb-mig' } },
    rules: [{ net: 'instagram', format: 'feed', days: [0], times: ['12:00'], on: true }],
    tags: { nets: { instagram: ['buildinpublic'], linkedin: [] }, projects: {} },
  }
  const cfg = schema.parse(merge(old))
  assert.deepEqual(Object.keys(cfg.nets).sort(), ['instagram', 'linkedin', 'tiktok', 'youtube'])
  assert.deepEqual(cfg.nets.tiktok, { on: true, handle: '' })
  assert.equal(cfg.nets.linkedin!.on, false)
  assert.deepEqual(cfg.tags.nets.youtube, [])
  assert.equal(cfg.rules.length, 1)
  assert.ok(defaults().rules.filter((r) => r.net === 'tiktok' || r.net === 'youtube').every((r) => !r.on && !r.days.length))
  assert.doesNotThrow(() => schema.parse(defaults()))
})
