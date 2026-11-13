import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

export const SAFE = ['-c', 'core.fsmonitor=false', '-c', 'gpg.program=false', '-c', 'gpg.ssh.program=false', '-c', 'gpg.x509.program=false', '-c', 'log.showSignature=false', '-c', 'core.pager=cat', '--no-pager']

export async function git(dir: string, args: string[], max = 1 << 20): Promise<string> {
  const { stdout } = await exec('git', [...SAFE, ...args], {
    cwd: dir,
    timeout: 8_000,
    maxBuffer: max,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat' },
  })
  return stdout
}

export type Activity = { last: string | null; week: number; month: number }

export async function activity(dir: string, now = Date.now()): Promise<Activity> {
  const [last, recent] = await Promise.all([
    git(dir, ['log', '-1', '--format=%ct']).catch(() => ''),
    git(dir, ['log', '--since=30.days.ago', '--format=%ct', '--max-count=5000']).catch(() => ''),
  ])
  const stamps = recent.split('\n').filter(Boolean).map(Number)
  const t = Number(last.trim())
  return {
    last: t ? new Date(t * 1000).toISOString() : null,
    week: stamps.filter((s) => now - s * 1000 <= 7 * 864e5).length,
    month: stamps.length,
  }
}
