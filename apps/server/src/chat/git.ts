import { fail } from '@social-grid/core/fault.ts'
import { git as run } from '@social-grid/vault/projects/git.ts'
import { z } from 'zod'
import { gitArgs, SUBS } from './policy.ts'

const MAX = 40_000
const RISKY = /^(filter\..+|gpg\..+|diff\..+\.(command|textconv)|diff\.external|core\.fsmonitor|core\.hookspath)$/i

export const shape = {
  sub: z.enum(SUBS).describe('subcomando: log, show, diff ou status'),
  args: z
    .array(z.string().max(300))
    .max(24)
    .optional()
    .describe('opções e refs, um por item (ex.: ["--oneline", "-n", "20"]). Caminhos depois de "--".'),
}

export const description =
  'Lê o git do projeto desta conversa (log, show, diff, status), sem shell. Opções que escrevem arquivo ou executam programa são recusadas.'

export async function risky(cwd: string): Promise<string[]> {
  const out = await run(cwd, ['config', '--local', '--includes', '--name-only', '--list']).catch(() => '')
  return out.split('\n').filter((k) => RISKY.test(k.trim()))
}

export async function git(cwd: string, sub: string, args: string[] = []): Promise<string> {
  const argv = gitArgs(sub, args)
  const bad = await risky(cwd)
  if (bad.length) fail('refused', `o .git/config deste projeto chama programas externos (${bad.slice(0, 3).join(', ')}); por segurança o git do chat não roda aqui`)
  const out = await run(cwd, argv, 4 << 20)
  return out.length > MAX ? `${out.slice(0, MAX)}\n[saída cortada em ${MAX} caracteres]` : out || '(sem saída)'
}
