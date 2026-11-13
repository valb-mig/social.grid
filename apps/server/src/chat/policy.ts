import { isAbsolute, sep } from 'node:path'
import { fail } from '@social-grid/core/fault.ts'

export type Verdict = { ok: true } | { ok: false; why: string }

export type Scope = {
  roots: string[]
  real: (path: string) => string | null
  web: string[]
}

export const MCP = 'social-grid'
const OURS = `mcp__${MCP}__`
const FREE = new Set(['Skill', 'WebSearch', 'TodoWrite', 'ToolSearch'])

export const TOOLS = ['Read', 'Glob', 'Grep', 'Skill', 'WebFetch', 'WebSearch', 'TodoWrite', 'ToolSearch']
export const WEB = ['github.com', 'raw.githubusercontent.com', 'gist.github.com', 'www.npmjs.com', 'npmjs.com', 'developer.mozilla.org']

export const SECRETS = [
  '.env*',
  '.envrc',
  '.dev.vars',
  '.git/config',
  '*.tfvars',
  '*.tfstate*',
  '.claude/settings.local.json',
  '*serviceAccount*.json',
  'credentials*.json',
  'kubeconfig*',
  '.docker/config.json',
  '.npmrc',
  '.netrc',
  '.pypirc',
  '.pgpass',
  '.git-credentials',
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  '*.jks',
  '*.keystore',
  '*.kdbx',
  '*.gpg',
  'id_rsa*',
  'id_ed25519*',
  'id_ecdsa*',
  'wp-config.php',
  'secrets.*',
  '.ssh/**',
  '.aws/**',
  '.gnupg/**',
  '.kube/**',
]

export const DENY = [
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
  'AskUserQuestion',
  'Agent',
  'Task',
  'Bash',
  'BashOutput',
  'KillShell',
  'KillBash',
  'Monitor',
  ...SECRETS.flatMap((g) => [`Read(**/${g})`, `Read(//**/${g})`]),
]

const esc = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

function rx(glob: string): string {
  const dir = glob.endsWith('/**')
  const body = (dir ? glob.slice(0, -3) : glob).split('*').map(esc).join('[^/]*')
  return `(^|/)${body}${dir ? '(/|$)' : '$'}`
}

const SECRET = new RegExp(SECRETS.map(rx).join('|'), 'i')

export const secret = (path: string) => SECRET.test(path.split(sep).join('/'))

const ok: Verdict = { ok: true }
const no = (why: string): Verdict => ({ ok: false, why })
const hidden = no('arquivo sensível: fora do alcance do chat')

const str = (v: unknown) => (typeof v === 'string' ? v : undefined)

function within(path: string, s: Scope): Verdict {
  if (!isAbsolute(path)) return no('use caminho absoluto')
  if (secret(path)) return hidden
  const real = s.real(path)
  if (!real) return no('caminho inválido')
  if (secret(real)) return hidden
  if (!s.roots.some((r) => real === r || real.startsWith(r + sep))) return no('fora do projeto, do vault e das skills')
  return ok
}

function pattern(p: string | undefined, s: Scope): Verdict {
  if (!p) return ok
  if (p.split(/[\\/]/).includes('..')) return no('padrão com ..')
  if (isAbsolute(p)) {
    const fixed = p.split(/[*?[{]/)[0] ?? ''
    return within(fixed.replace(/\/[^/]*$/, '') || '/', s)
  }
  if (secret(p)) return hidden
  return ok
}

function web(url: string | undefined, s: Scope): Verdict {
  if (!url) return no('sem url')
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return no('só https padrão')
    if (!s.web.includes(u.hostname)) return no(`domínio fora da lista: ${u.hostname}`)
    return ok
  } catch {
    return no('url inválida')
  }
}

export function allow(tool: string, input: Record<string, unknown>, s: Scope): Verdict {
  if (tool.startsWith(OURS)) return ok
  if (FREE.has(tool)) return ok
  switch (tool) {
    case 'Read':
      return within(str(input.file_path) ?? '', s)
    case 'Glob': {
      const path = str(input.path)
      const v = path ? within(path, s) : ok
      return v.ok ? pattern(str(input.pattern), s) : v
    }
    case 'Grep': {
      const path = str(input.path)
      const v = path ? within(path, s) : ok
      return v.ok ? pattern(str(input.glob), s) : v
    }
    case 'WebFetch':
      return web(str(input.url), s)
    default:
      return no(`${tool} não está liberado no chat do social.grid`)
  }
}

export const SUBS = ['log', 'show', 'diff', 'status'] as const
export type Sub = (typeof SUBS)[number]

const TEXT = '[^\\0\\n\\r]{1,120}'
const DATE = '[\\w.:+-]{1,40}'

const FLAGS: Record<Sub, RegExp> = {
  log: new RegExp(
    `^(--oneline|--stat|--shortstat|--name-only|--name-status|--no-merges|--merges|--reverse|--decorate|--all|-p|--patch|-\\d{1,4}|--max-count=\\d{1,4}|--since=${DATE}|--until=${DATE}|--after=${DATE}|--before=${DATE}|--author=${TEXT}|--grep=${TEXT}|--format=${TEXT}|--pretty=(oneline|short|medium|full|fuller|format:${TEXT}))$`,
  ),
  show: new RegExp(`^(--stat|--shortstat|--name-only|--name-status|-p|--patch|--no-patch|-s|--format=${TEXT}|--pretty=(oneline|short|medium|full|fuller|format:${TEXT}))$`),
  diff: /^(--stat|--shortstat|--name-only|--name-status|--cached|--staged|-U\d{1,2}|--unified=\d{1,2}|--word-diff)$/,
  status: /^(--short|-s|--porcelain|--branch|-b|-uno|--untracked-files=(no|normal))$/,
}

const REF = /^[A-Za-z0-9_][A-Za-z0-9._/@^~:+-]{0,199}$/
const PATH = /^[A-Za-z0-9_][A-Za-z0-9._/@ +-]{0,299}$/
const SIGNED = /^--(format|pretty)=.*%G/

export function gitArgs(sub: string, args: string[]): string[] {
  if (!SUBS.includes(sub as Sub)) fail('refused', `git ${sub} não é permitido: use log, show, diff ou status`)
  const flags = FLAGS[sub as Sub]
  const out: string[] = []
  let paths = false
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (paths) {
      if (!PATH.test(a) || a.split('/').includes('..')) fail('refused', `caminho inválido: ${a}`)
      out.push(a)
      continue
    }
    if (a === '--') {
      paths = true
      out.push(a)
      continue
    }
    if (a === '-n' && sub === 'log') {
      const n = args[++i] ?? ''
      if (!/^\d{1,4}$/.test(n)) fail('refused', '-n precisa de um número')
      out.push('-n', n)
      continue
    }
    if (a.startsWith('-')) {
      if (!flags.test(a)) fail('refused', `opção não permitida: ${a}`)
      if (SIGNED.test(a)) fail('refused', 'formato com %G verifica assinatura e roda o gpg: não é permitido')
      out.push(a)
      continue
    }
    if (sub === 'status' || !REF.test(a)) fail('refused', `argumento inválido: ${a}`)
    out.push(a)
  }
  const safe = sub === 'status' ? ['--ignore-submodules=all'] : ['--no-ext-diff', '--no-textconv', ...(sub === 'diff' ? ['--ignore-submodules=all'] : [])]
  return [sub, ...safe, ...out]
}
