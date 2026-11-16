import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { fail } from '@social-grid/core/fault.ts'

const run = promisify(execFile)

export const SIZES = {
  retrato: { w: 1080, h: 1350 },
  quadrado: { w: 1080, h: 1080 },
  vertical: { w: 1080, h: 1920 },
  paisagem: { w: 1920, h: 1080 },
} as const

export type Shape = keyof typeof SIZES
export type Size = { w: number; h: number }

export const CSP = "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:"

const BINS = ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']

const FONTS: [string, string, number[]][] = [
  ['Manrope', '@fontsource/manrope/files/manrope-latin-%-normal.woff2', [400, 500, 600, 700, 800]],
  ['JetBrains Mono', '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-%-normal.woff2', [400, 500, 700]],
]

let faces: Promise<string> | null = null

function fonts(): Promise<string> {
  faces ??= Promise.all(
    FONTS.flatMap(([family, path, weights]) =>
      weights.map(async (w) => {
        const data = await readFile(fileURLToPath(import.meta.resolve(path.replace('%', String(w)))))
        return `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:block;src:url(data:font/woff2;base64,${data.toString('base64')}) format('woff2')}`
      }),
    ),
  ).then((list) => list.join(''))
  return faces
}

export function page(html: string, css: string): string {
  const body = html.replace(/<meta\b[^>]*>/gi, '')
  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><style>${css}body{margin:0}</style>`
  const doctype = /^\s*<!doctype[^>]*>/i.exec(body)
  return doctype ? doctype[0] + head + body.slice(doctype[0].length) : `<!doctype html>${head}${body}`
}

async function chrome(): Promise<string> {
  const fixed = process.env.SOCIAL_GRID_CHROME
  if (fixed) return fixed
  for (const dir of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    for (const b of BINS) {
      const p = join(dir, b)
      if (await access(p, constants.X_OK).then(() => true, () => false)) return p
    }
  }
  return fail('not_found', 'para gerar imagem o app precisa do Google Chrome ou do Chromium no PC')
}

let line: Promise<unknown> = Promise.resolve()

export function render<T>(html: string, s: Size, use: (file: string) => Promise<T>): Promise<T> {
  const job = line.then(() => shot(html, s, use))
  line = job.catch(() => undefined)
  return job
}

async function shot<T>(html: string, s: Size, use: (file: string) => Promise<T>): Promise<T> {
  const bin = await chrome()
  const dir = await mkdtemp(join(tmpdir(), 'sg-arte-'))
  try {
    const src = join(dir, 'arte.html')
    const out = join(dir, 'arte.png')
    await writeFile(src, page(html, await fonts()))
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--mute-audio',
      '--force-device-scale-factor=1',
      `--user-data-dir=${join(dir, 'perfil')}`,
      '--proxy-server=http://127.0.0.1:9',
      '--proxy-bypass-list=<-loopback>',
      `--window-size=${s.w},${s.h}`,
      `--screenshot=${out}`,
      pathToFileURL(src).href,
    ]
    await run(bin, args, { timeout: 45_000, maxBuffer: 4 << 20 }).catch((e: unknown) => {
      if ((e as { code?: unknown }).code === 'ENOENT') fail('not_found', `o Chrome não está em ${bin}`)
      fail('invalid', 'o Chrome não conseguiu gerar a imagem')
    })
    const png = await readFile(out).catch(() => fail('invalid', 'o Chrome não gerou a imagem'))
    if (png.length < 24 || png.toString('ascii', 1, 4) !== 'PNG') fail('invalid', 'o Chrome não gerou um PNG')
    if (png.readUInt32BE(16) !== s.w || png.readUInt32BE(20) !== s.h) fail('invalid', 'a imagem saiu com um tamanho diferente do pedido')
    return await use(out)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
