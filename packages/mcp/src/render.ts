import { execFile, spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import type { Readable, Writable } from 'node:stream'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { Fault, fail } from '@social-grid/core/fault.ts'

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
  return fail('not_found', 'para gerar imagem ou tirar print o app precisa do Google Chrome ou do Chromium no PC')
}

let line: Promise<unknown> = Promise.resolve()

function queue<T>(fn: () => Promise<T>): Promise<T> {
  const job = line.then(fn)
  line = job.catch(() => undefined)
  return job
}

const BASE = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio']

const LOCKED = ['--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>']

function checked(png: Buffer, s: Size): Buffer {
  if (png.length < 24 || png.toString('ascii', 1, 4) !== 'PNG') fail('invalid', 'o Chrome não gerou um PNG')
  if (png.readUInt32BE(16) !== s.w || png.readUInt32BE(20) !== s.h) fail('invalid', 'a imagem saiu com um tamanho diferente do pedido')
  return png
}

export function render<T>(html: string, s: Size, use: (file: string) => Promise<T>): Promise<T> {
  return queue(async () => {
    const bin = await chrome()
    const dir = await mkdtemp(join(tmpdir(), 'sg-arte-'))
    try {
      const src = join(dir, 'arte.html')
      const out = join(dir, 'arte.png')
      await writeFile(src, page(html, await fonts()))
      const args = [...BASE, '--force-device-scale-factor=1', `--user-data-dir=${join(dir, 'perfil')}`, ...LOCKED, `--window-size=${s.w},${s.h}`, `--screenshot=${out}`, pathToFileURL(src).href]
      await run(bin, args, { timeout: 60_000, maxBuffer: 4 << 20 }).catch((e: unknown) => {
        if ((e as { code?: unknown }).code === 'ENOENT') fail('not_found', `o Chrome não está em ${bin}`)
        fail('invalid', 'o Chrome não conseguiu gerar a imagem')
      })
      checked(await readFile(out).catch(() => fail('invalid', 'o Chrome não gerou a imagem')), s)
      return await use(out)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
}

export function capture<T>(url: string, s: Size, scale: number, use: (file: string) => Promise<T>): Promise<T> {
  return queue(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sg-print-'))
    try {
      const png = checked(await devtools(dir, (cdp) => snap(cdp, url, s, scale)), s)
      const out = join(dir, 'print.png')
      await writeFile(out, png)
      return await use(out)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
}

type Msg = { id?: number; method?: string; params?: Record<string, unknown>; result?: Record<string, unknown>; error?: { message: string }; sessionId?: string }

type Cdp = {
  send(method: string, params?: object, session?: string): Promise<Record<string, unknown>>
  wait(test: (m: Msg) => boolean, ms: number): Promise<Msg | null>
}

const BUDGET = 8000
const WAIT = 30_000

async function snap(cdp: Cdp, url: string, s: Size, scale: number): Promise<Buffer> {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = (await cdp.send('Target.attachToTarget', { targetId, flatten: true })) as { sessionId: string }
  const page = (method: string, params?: object) => cdp.send(method, params, sessionId)
  await page('Page.enable')
  await page('Emulation.setDeviceMetricsOverride', { width: s.w / scale, height: s.h / scale, deviceScaleFactor: scale, mobile: false })
  await page('Emulation.setVirtualTimePolicy', { policy: 'pause' })
  const nav = await page('Page.navigate', { url })
  if (nav.errorText) fail('invalid', `a página não abriu (${String(nav.errorText)}); o app está rodando?`)
  await page('Emulation.setVirtualTimePolicy', { policy: 'pauseIfNetworkFetchesPending', budget: BUDGET })
  await cdp.wait((m) => m.sessionId === sessionId && m.method === 'Emulation.virtualTimeBudgetExpired', WAIT)
  const { data } = await page('Page.captureScreenshot', { format: 'png' })
  return Buffer.from(String(data), 'base64')
}

async function devtools<T>(dir: string, fn: (cdp: Cdp) => Promise<T>): Promise<T> {
  const bin = await chrome()
  const child = spawn(bin, [...BASE, `--user-data-dir=${join(dir, 'perfil')}`, '--remote-debugging-pipe', 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] })
  const input = child.stdio[3] as Writable
  const output = child.stdio[4] as Readable
  const pending = new Map<number, { ok: (r: Record<string, unknown>) => void; ko: (e: unknown) => void }>()
  const seen: Msg[] = []
  const waits = new Set<(m: Msg) => void>()
  let dead: unknown = null
  let next = 1
  let buf = ''
  const die = (e: unknown) => {
    dead ??= e
    for (const p of pending.values()) p.ko(dead)
    pending.clear()
  }
  child.on('error', (e: NodeJS.ErrnoException) => die(e.code === 'ENOENT' ? new Fault('not_found', `o Chrome não está em ${bin}`) : new Fault('invalid', 'o Chrome não abriu')))
  child.on('exit', () => die(new Fault('invalid', 'o Chrome fechou antes do print')))
  input.on('error', () => undefined)
  output.setEncoding('utf8')
  output.on('data', (chunk: string) => {
    buf += chunk
    for (let i = buf.indexOf('\0'); i >= 0; i = buf.indexOf('\0')) {
      const m = JSON.parse(buf.slice(0, i)) as Msg
      buf = buf.slice(i + 1)
      if (m.id !== undefined) {
        const p = pending.get(m.id)
        pending.delete(m.id)
        if (m.error) p?.ko(new Fault('invalid', `o Chrome recusou o print: ${m.error.message}`))
        else p?.ok(m.result ?? {})
      } else {
        seen.push(m)
        for (const w of waits) w(m)
      }
    }
  })
  const cdp: Cdp = {
    send: (method, params = {}, session) =>
      new Promise((ok, ko) => {
        if (dead) return ko(dead)
        const id = next++
        pending.set(id, { ok, ko })
        input.write(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }) + '\0')
      }),
    wait: (test, ms) =>
      new Promise((ok) => {
        const hit = seen.find(test)
        if (hit) return ok(hit)
        const w = (m: Msg) => {
          if (!test(m)) return
          clearTimeout(t)
          waits.delete(w)
          ok(m)
        }
        const t = setTimeout(() => {
          waits.delete(w)
          ok(null)
        }, ms)
        waits.add(w)
      }),
  }
  const limit = setTimeout(() => die(new Fault('invalid', 'o print passou de 60 s')), 60_000)
  try {
    return await fn(cdp)
  } finally {
    clearTimeout(limit)
    if (child.pid !== undefined && child.exitCode === null) {
      if (!dead) {
        const gone = new Promise((ok) => child.once('exit', ok))
        await cdp.send('Browser.close').catch(() => undefined)
        await Promise.race([gone, new Promise((ok) => setTimeout(ok, 3000))])
      }
      child.kill('SIGKILL')
    }
  }
}
