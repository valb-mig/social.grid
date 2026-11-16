import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dress, frame, MAX, MODELS, scan } from '../src/mockup.ts'

const svg = (uri: string) => Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64').toString()

test('a tela de cada modelo é o buraco da máscara do desenho, então o conteúdo cai onde o aparelho mostra', () => {
  for (const m of Object.values(MODELS)) {
    const t = m.tela
    for (const cor of Object.keys(m.cores)) {
      const s = svg(frame(m, cor))
      assert.match(s, new RegExp(`viewBox="0 0 ${m.w} ${m.h}"`), m.id)
      if (typeof t.r === 'number') {
        const hole = new RegExp(`<mask[^>]*>.*<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}"${t.r ? ` rx="${t.r}"` : ''} fill="#000"/></mask>`)
        assert.match(s, hole, `${m.id} ${cor}`)
      }
      assert.doesNotMatch(s, /<script|<image|<text|href=|url\((?!#)/i, `${m.id} ${cor}`)
    }
    assert.ok(t.x >= 0 && t.y > 0 && t.x + t.w <= m.w && t.y + t.h <= m.h, m.id)
  }
  const nav = MODELS.navegador!
  assert.deepEqual([nav.tela.x, nav.tela.w, nav.tela.y + nav.tela.h], [0, nav.w, nav.h])
  assert.equal(nav.sangria, 0)
  assert.match(svg(frame(nav, 'claro')), new RegExp(`M0 ${nav.tela.y}V12.*V${nav.tela.y}Z`))
  assert.equal(MODELS.celular!.tela.w / MODELS.celular!.tela.h, 393 / 852)
  assert.equal(MODELS.laptop!.tela.w / MODELS.laptop!.tela.h, 16 / 10)
})

test('scan lê modelo, cor, largura, style e o conteúdo da tela, com os padrões do modelo', () => {
  const html = `<body><h1>oi</h1><sg-mockup modelo="celular" style='left:10px;font-family:"Manrope"'><p>tela</p></sg-mockup><SG-MOCKUP modelo=laptop cor="prata" largura="470" print="/hoje"/></body>`
  const [a, b] = scan(html)
  assert.equal(a!.model.id, 'celular')
  assert.equal(a!.cor, 'preto')
  assert.equal(a!.width, 400)
  assert.equal(a!.inner, '<p>tela</p>')
  assert.equal(a!.style, 'left:10px;font-family:"Manrope"')
  assert.equal(b!.model.id, 'laptop')
  assert.equal(b!.cor, 'prata')
  assert.equal(b!.width, 470)
  assert.equal(b!.print, '/hoje')
  assert.equal(b!.inner, '')

  const out = dress(html, [a!, b!], [null, 'data:image/png;base64,AAAA'])
  assert.ok(out.startsWith('<body><h1>oi</h1><div style="position:relative;width:400px;height:807.223px;left:10px;font-family:&quot;Manrope&quot;">'))
  assert.ok(out.endsWith('</div></body>'))
  assert.doesNotMatch(out, /sg-mockup/i)
  assert.match(out, /<p>tela<\/p>/)
  assert.match(out, /width:470px;height:272px/)
  assert.match(out, /<img src="data:image\/png;base64,AAAA"/)
  assert.equal(scan('<body>sem mockup</body>').length, 0)
})

test('navegador escreve o endereço escapado na barra, por cima da moldura, e só ele aceita endereco', () => {
  const html = '<sg-mockup modelo="navegador" endereco="mocha.app/<b>&x"/><sg-mockup modelo="navegador" cor="escuro"/>'
  const [a, b] = scan(html)
  assert.equal(a!.cor, 'claro')
  assert.equal(a!.endereco, 'mocha.app/<b>&x')
  const one = dress(html.slice(0, a!.at[1]), [a!], [null])
  assert.match(one, /<span style="overflow:hidden;text-overflow:ellipsis">mocha\.app\/&lt;b&gt;&amp;x<\/span><\/div><\/div>$/)
  assert.ok(one.indexOf('mocha.app') > one.indexOf('data:image/svg+xml'))
  assert.doesNotMatch(one, /background:#000/)
  assert.match(one, /border-radius:0px 0px 7\.5px 7\.5px/)
  const two = dress(html, [b!], [null]).slice(a!.at[1])
  assert.doesNotMatch(two, /ellipsis/)
})

test('scan recusa o que não dá para desenhar, com a mensagem do que fazer', () => {
  const bad: [string, RegExp][] = [
    ['<sg-mockup modelo="tablet"></sg-mockup>', /desconhecido: tablet; existem celular, laptop, navegador/],
    ['<sg-mockup></sg-mockup>', /precisa de modelo/],
    ['<sg-mockup modelo="laptop" cor="roxo"></sg-mockup>', /laptop vem nas cores preto, prata/],
    ['<sg-mockup modelo="celular" largura="50"></sg-mockup>', /largura/],
    ['<sg-mockup modelo="celular" largura="40%"></sg-mockup>', /largura/],
    ['<sg-mockup modelo="celular" onload="x()"></sg-mockup>', /não aceita o atributo onload/],
    ['<sg-mockup modelo="celular" endereco="mocha.app"></sg-mockup>', /endereco só vale no navegador/],
    [`<sg-mockup modelo="navegador" endereco="${'a'.repeat(81)}"></sg-mockup>`, /até 80 caracteres/],
    ['<sg-mockup modelo="navegador" endereco="a\nb"></sg-mockup>', /numa linha/],
    ['<sg-mockup modelo="navegador" cor="roxo"></sg-mockup>', /navegador vem nas cores claro, escuro/],
    ['<sg-mockup modelo="celular" print="/hoje" midia="m-a.png"></sg-mockup>', /print ou midia/],
    ['<sg-mockup modelo="celular"><p>sem fechar</p>', /faltou fechar/],
    ['<p>oi</p></sg-mockup>', /sobrando/],
    ['<sg-mockup modelo="celular"><sg-mockup modelo="celular"></sg-mockup></sg-mockup>', /dentro de outro/],
    ['<sg-mockup modelo="celular"/>'.repeat(MAX + 1), /no máximo 6/],
    ['<sg-mockup modelo="celular" print="/a"/>'.repeat(3), /2 sg-mockup com print/],
  ]
  for (const [html, msg] of bad) assert.throws(() => scan(html), msg, html)
})
