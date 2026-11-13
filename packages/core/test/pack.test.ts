import assert from 'node:assert/strict'
import { test } from 'node:test'
import { instagram } from '../src/network/instagram.ts'
import { linkedin } from '../src/network/linkedin.ts'
import { hook } from '../src/network/net.ts'
import { post } from './kit.ts'

test('pacote do carrossel sai com a mídia na ordem salva, a legenda e as hashtags com #', () => {
  const p = post({
    format: 'carrossel',
    media: ['m-cccccccccc.jpg', 'm-aaaaaaaaaa.jpg', 'm-bbbbbbbbbb.png'],
    caption: 'Seu design ainda mora em print solto no WhatsApp?\n\nAí fiz o mocha.\n',
    hashtags: ['#buildinpublic', 'devbrasil', '##mcp', 'DevBrasil'],
  })
  const pk = instagram.pack(p)
  assert.deepEqual(pk.media, ['m-cccccccccc.jpg', 'm-aaaaaaaaaa.jpg', 'm-bbbbbbbbbb.png'])
  assert.equal(pk.tags, '#buildinpublic #devbrasil #mcp')
  assert.equal(pk.caption, 'Seu design ainda mora em print solto no WhatsApp?\n\nAí fiz o mocha.')
  assert.equal(pk.text, `${pk.caption}\n\n#buildinpublic #devbrasil #mcp`)
})

test('no LinkedIn o link vai separado no comentário do pacote', () => {
  const pk = linkedin.pack(post({ network: 'linkedin', format: 'post', caption: 'Texto', hashtags: ['ia'], comment: ' https://github.com/valb-mig/editr ' }))
  assert.equal(pk.comment, 'https://github.com/valb-mig/editr')
  assert.equal(pk.text, 'Texto\n\n#ia')
})

test('o gancho é o que cabe antes do corte do "mais"', () => {
  assert.deepEqual(hook('Curto\nresto', 125), { head: 'Curto', fits: true })
  const longo = hook('x'.repeat(130), 125)
  assert.equal(longo.fits, false)
  assert.equal(longo.head.length, 125)
})
