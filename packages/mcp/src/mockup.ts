import { fail } from '@social-grid/core/fault.ts'

export type Box = { x: number; y: number; w: number; h: number; r: number | [number, number, number, number] }

type Px = (v: number) => string
type At = (x: number, y: number, w: number, h: number) => string

export type Model = {
  id: string
  w: number
  h: number
  tela: Box
  largura: number
  sangria: number
  aceita: string[]
  cores: Record<string, string[]>
  svg(c: string[]): string
  topo?(c: string[], s: Spec, at: At, px: Px): string
}

const celular: Model = {
  id: 'celular',
  w: 443,
  h: 894,
  tela: { x: 25, y: 21, w: 393, h: 852, r: 55 },
  largura: 400,
  sangria: 4,
  aceita: [],
  cores: {
    preto: ['#2c2c30', '#6a6a70', '#9a9aa0'],
    prata: ['#c3c6cb', '#f4f5f7', '#ffffff'],
    roxo: ['#5e465d', '#a597a4', '#d2c6d1'],
  },
  svg: ([a, b, c]) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 443 894" preserveAspectRatio="none">
<defs>
<linearGradient id="m" x1="0" x2="1"><stop offset="0" stop-color="${a}"/><stop offset=".025" stop-color="${b}"/><stop offset=".07" stop-color="${a}"/><stop offset=".93" stop-color="${a}"/><stop offset=".975" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient>
<linearGradient id="k" x1="0" x2="1"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient>
<mask id="t" maskUnits="userSpaceOnUse" x="0" y="0" width="443" height="894"><rect width="443" height="894" fill="#fff"/><rect x="25" y="21" width="393" height="852" rx="55" fill="#000"/></mask>
</defs>
<g fill="url(#k)"><rect x="0" y="141" width="8" height="35" rx="2"/><rect x="0" y="206" width="8" height="68" rx="2"/><rect x="0" y="291" width="8" height="68" rx="2"/><rect x="435" y="228" width="8" height="108" rx="2"/></g>
<g mask="url(#t)">
<rect x="4" y="0" width="435" height="894" rx="76" fill="url(#m)"/>
<rect x="4.75" y=".75" width="433.5" height="892.5" rx="75.25" fill="none" stroke="${c}" stroke-opacity=".7" stroke-width="1.5"/>
<rect x="9.5" y="5.5" width="424" height="883" rx="70.5" fill="${a}"/>
<rect x="11" y="7" width="421" height="880" rx="69" fill="#0a0a0b"/>
</g>
<rect x="158.5" y="32" width="126" height="37" rx="18.5" fill="#000"/>
<circle cx="265.5" cy="50.5" r="6.5" fill="#0d101a"/>
<circle cx="265.5" cy="50.5" r="3.2" fill="#1d2747"/>
<circle cx="264.2" cy="49.2" r="1.1" fill="#7d8fc8" fill-opacity=".8"/>
</svg>`,
}

const laptop: Model = {
  id: 'laptop',
  w: 1880,
  h: 1088,
  tela: { x: 220, y: 69, w: 1440, h: 900, r: 0 },
  largura: 900,
  sangria: 4,
  aceita: [],
  cores: {
    preto: ['#36383c', '#a3a6ab', '#6c6f74', '#3b3d41', '#55585d', '#7d8085'],
    prata: ['#c4c7cc', '#eceef0', '#b5b8bd', '#8c8f94', '#a2a5aa', '#cdd0d4'],
  },
  svg: ([edge, top, bottom, under, n1, n2]) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1880 1088" preserveAspectRatio="none">
<defs>
<linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
<linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".06" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".12"/><stop offset=".94" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>
<linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${n1}"/><stop offset="1" stop-color="${n2}"/></linearGradient>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity=".04"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="t" maskUnits="userSpaceOnUse" x="0" y="0" width="1880" height="1088"><rect width="1880" height="1088" fill="#fff"/><rect x="220" y="69" width="1440" height="900" fill="#000"/></mask>
</defs>
<g mask="url(#t)">
<path d="M177 1025V34a34 34 0 0 1 34-34H1669a34 34 0 0 1 34 34V1025Z" fill="${edge}"/>
<path d="M181 1025V35a30 30 0 0 1 30-30H1669a30 30 0 0 1 30 30V1025Z" fill="#050607"/>
<path d="M181 35a30 30 0 0 1 30-30H900L181 720Z" fill="url(#g)"/>
<rect x="181" y="1013" width="1518" height="12" fill="#121315"/>
</g>
<circle cx="940" cy="37" r="7" fill="#17181b"/>
<circle cx="940" cy="37" r="3" fill="#26304d"/>
<path d="M0 1031q0-6 6-6H1874q6 0 6 6v30H0Z" fill="url(#d)"/>
<path d="M0 1031q0-6 6-6H1874q6 0 6 6v30H0Z" fill="url(#s)"/>
<rect x="6" y="1025" width="1868" height="2" fill="#fff" fill-opacity=".45"/>
<path d="M0 1061C60 1082 160 1088 220 1088H1660C1720 1088 1820 1082 1880 1061Z" fill="${under}"/>
<path d="M790 1025H1090V1035a10 10 0 0 1-10 10H800a10 10 0 0 1-10-10Z" fill="url(#n)"/>
</svg>`,
}

const esc = (v: string) => v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

const navegador: Model = {
  id: 'navegador',
  w: 1440,
  h: 952,
  tela: { x: 0, y: 52, w: 1440, h: 900, r: [0, 0, 12, 12] },
  largura: 900,
  sangria: 0,
  aceita: ['endereco'],
  cores: {
    claro: ['#f3f3f5', '#d9d9dc', '#e3e3e6', '#3a3a3c', '#8e8e93', '#c7c7cc'],
    escuro: ['#2c2c2e', '#18181a', '#3a3a3c', '#e5e5ea', '#98989d', '#4a4a4d'],
  },
  svg: ([bar, line, pill, , icon, edge]) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 952" preserveAspectRatio="none">
<path d="M0 52V12A12 12 0 0 1 12 0H1428A12 12 0 0 1 1440 12V52Z" fill="${bar}"/>
<rect x="0" y="51" width="1440" height="1" fill="${line}"/>
<g stroke="#000" stroke-opacity=".12" stroke-width=".5"><circle cx="20" cy="26" r="6" fill="#ff5f57"/><circle cx="40" cy="26" r="6" fill="#febc2e"/><circle cx="60" cy="26" r="6" fill="#28c840"/></g>
<g fill="none" stroke="${icon}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
<rect x="92" y="18" width="20" height="16" rx="3"/><path d="M99 18V34"/>
<path d="M144 20l-6 6 6 6"/><path d="M166 20l6 6-6 6" stroke-opacity=".45"/>
<path d="M1333 23h-3v12h14V23h-3M1337 29V15m-4 4l4-4 4 4"/>
<path d="M1378 20v12M1372 26h12"/>
<rect x="1400" y="21" width="12" height="12" rx="2"/><path d="M1404 18h8a3 3 0 0 1 3 3v8"/>
</g>
<rect x="440" y="11" width="560" height="30" rx="8" fill="${pill}"/>
<path d="M987 21.5a5.5 5.5 0 1 0 1.6 3.9M987 18v3.5h-3.5" fill="none" stroke="${icon}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
<rect x=".75" y=".75" width="1438.5" height="950.5" rx="11.25" fill="none" stroke="${edge}" stroke-width="1.5"/>
</svg>`,
  topo: ([, , , text], s, at, px) =>
    s.endereco
      ? `<div style="${at(456, 11, 512, 30)};display:flex;align-items:center;justify-content:center;gap:${px(6)};font:500 ${px(14)}/1 Manrope,sans-serif;color:${text};white-space:nowrap">` +
        `<svg viewBox="0 0 10 12" style="width:${px(9)};height:${px(11)};flex:none"><rect x="1" y="5" width="8" height="7" rx="1.5" fill="${text}"/><path d="M3 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="${text}" stroke-width="1.4"/></svg>` +
        `<span style="overflow:hidden;text-overflow:ellipsis">${esc(s.endereco)}</span></div>`
      : '',
}

export const MODELS: Record<string, Model> = { celular, laptop, navegador }

export const about = Object.values(MODELS)
  .map((m) => `${m.id} (tela ${m.tela.w}x${m.tela.h}, cor ${Object.keys(m.cores).join(', ')}, largura padrão ${m.largura}${m.aceita.length ? `, aceita ${m.aceita.join(', ')}` : ''})`)
  .join('; ')

export const MAX = 6
export const PRINTS = 2

const EXTRAS = new Set(Object.values(MODELS).flatMap((m) => m.aceita))
const ATTRS = new Set(['modelo', 'cor', 'largura', 'print', 'midia', 'style', 'class', ...EXTRAS])

export type Spec = {
  at: [number, number]
  model: Model
  cor: string
  width: number
  style: string
  cls: string
  inner: string
  print?: string
  midia?: string
  endereco?: string
}

const TAG = /<sg-mockup\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/gi
const CLOSE = /<\/sg-mockup\s*>/gi

function attrs(raw: string): Map<string, string> {
  const out = new Map<string, string>()
  const re = /([a-z][\w-]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gi
  for (const m of raw.matchAll(re)) {
    const name = m[1]!.toLowerCase()
    if (!ATTRS.has(name)) fail('invalid', `sg-mockup não aceita o atributo ${name}; use ${[...ATTRS].join(', ')}`)
    out.set(name, m[3] ?? m[4] ?? m[5] ?? '')
  }
  return out
}

export function scan(html: string): Spec[] {
  const specs: Spec[] = []
  let paired = 0
  for (const m of html.matchAll(TAG)) {
    const start = m.index
    const open = start + m[0].length
    if (specs.length && start < specs.at(-1)!.at[1]) fail('invalid', 'sg-mockup dentro de outro sg-mockup não vale')
    let end = open
    let inner = ''
    if (!m[2]) {
      CLOSE.lastIndex = open
      const c = CLOSE.exec(html)
      if (!c) fail('invalid', 'faltou fechar o sg-mockup com </sg-mockup>')
      inner = html.slice(open, c.index)
      end = c.index + c[0].length
      paired++
    }
    const a = attrs(m[1]!)
    const id = a.get('modelo') ?? fail('invalid', `sg-mockup precisa de modelo: ${Object.keys(MODELS).join(', ')}`)
    const model = MODELS[id] ?? fail('invalid', `modelo de mockup desconhecido: ${id}; existem ${Object.keys(MODELS).join(', ')}`)
    const cor = a.get('cor') ?? Object.keys(model.cores)[0]!
    if (!model.cores[cor]) fail('invalid', `o ${id} vem nas cores ${Object.keys(model.cores).join(', ')}`)
    const w = a.has('largura') ? Number(a.get('largura')) : model.largura
    if (!Number.isInteger(w) || w < 80 || w > 4000) fail('invalid', 'largura do sg-mockup vai em px, número inteiro de 80 a 4000')
    if (a.has('print') && a.has('midia')) fail('invalid', 'sg-mockup leva print ou midia, não os dois')
    for (const name of a.keys()) {
      if (EXTRAS.has(name) && !model.aceita.includes(name))
        fail('invalid', `${name} só vale no ${Object.values(MODELS).filter((o) => o.aceita.includes(name)).map((o) => o.id).join(', ')}`)
    }
    const endereco = a.get('endereco')
    if (endereco !== undefined && (endereco.length > 80 || /[\u0000-\u001f\u007f]/.test(endereco))) fail('invalid', 'endereco vai numa linha, com até 80 caracteres')
    specs.push({
      at: [start, end],
      model,
      cor,
      width: w,
      style: a.get('style') ?? '',
      cls: a.get('class') ?? '',
      inner,
      ...(a.has('print') ? { print: a.get('print')! } : {}),
      ...(a.has('midia') ? { midia: a.get('midia')! } : {}),
      ...(endereco ? { endereco } : {}),
    })
  }
  CLOSE.lastIndex = 0
  if ([...html.matchAll(CLOSE)].length !== paired) fail('invalid', '</sg-mockup> sobrando, sem a abertura')
  if (specs.length > MAX) fail('invalid', `no máximo ${MAX} sg-mockup por imagem`)
  if (specs.filter((s) => s.print).length > PRINTS) fail('invalid', `no máximo ${PRINTS} sg-mockup com print por imagem`)
  return specs
}

export const scale = (s: Spec) => s.width / s.model.w

const attr = (v: string) => v.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
const n = (v: number) => `${+v.toFixed(3)}px`

export function frame(model: Model, cor: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(model.svg(model.cores[cor]!)).toString('base64')}`
}

export function piece(s: Spec, img: string | null): string {
  const k = scale(s)
  const m = s.model
  const t = m.tela
  const b = m.sangria
  const px = (v: number) => n(v * k)
  const at = (x: number, y: number, w: number, h: number) => `position:absolute;left:${px(x)};top:${px(y)};width:${px(w)};height:${px(h)}`
  const round = (d: number) => (typeof t.r === 'number' ? [t.r] : t.r).map((r) => px(r + d)).join(' ')
  return (
    `<div${s.cls ? ` class="${attr(s.cls)}"` : ''} style="position:relative;width:${s.width}px;height:${px(m.h)};${attr(s.style)}">` +
    (b ? `<div style="${at(t.x - b, t.y - b, t.w + 2 * b, t.h + 2 * b)};background:#000;border-radius:${round(b)}"></div>` : '') +
    `<div style="${at(t.x, t.y, t.w, t.h)};overflow:hidden;background:#fff;border-radius:${round(0)}">` +
    `<div style="position:absolute;left:0;top:0;width:${t.w}px;height:${t.h}px;transform:scale(${+k.toFixed(6)});transform-origin:0 0">` +
    (img ? `<img src="${img}" alt="" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;object-position:top">` : '') +
    s.inner +
    `</div></div>` +
    `<img src="${frame(m, s.cor)}" alt="" style="position:absolute;left:0;top:0;width:100%;height:100%">` +
    (m.topo?.(m.cores[s.cor]!, s, at, px) ?? '') +
    `</div>`
  )
}

export function dress(html: string, specs: Spec[], imgs: (string | null)[]): string {
  let out = ''
  let from = 0
  specs.forEach((s, i) => {
    out += html.slice(from, s.at[0]) + piece(s, imgs[i] ?? null)
    from = s.at[1]
  })
  return out + html.slice(from)
}
