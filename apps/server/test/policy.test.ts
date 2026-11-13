import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { Fault } from '@social-grid/core/fault.ts'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { git } from '../src/chat/git.ts'
import { allow, DENY, gitArgs, SECRETS, secret } from '../src/chat/policy.ts'
import { scope } from '../src/chat/session.ts'

async function setup() {
  const home = await mkdtemp(join(tmpdir(), 'sg-policy-'))
  const project = join(home, 'Projects', 'mocha.app')
  const vault = join(home, 'SocialGrid')
  await mkdir(project, { recursive: true })
  await mkdir(vault)
  await mkdir(join(home, '.ssh'))
  await writeFile(join(home, '.ssh', 'id_ed25519'), 'chave')
  await writeFile(join(project, 'README.md'), '# mocha')
  await writeFile(join(project, '.env'), 'TOKEN=x')
  await symlink(join(home, '.ssh', 'id_ed25519'), join(project, 'icon.png'))
  return { home, project, s: scope([project, vault, join(home, '.claude', 'skills')]) }
}

const yes = (v: { ok: boolean }) => assert.equal(v.ok, true)
const no = (v: { ok: boolean }) => assert.equal(v.ok, false)

test('chat lê o projeto, mas não lê segredo nem nada fora dele', async () => {
  const { home, project, s } = await setup()
  yes(allow('Read', { file_path: join(project, 'README.md') }, s))
  no(allow('Read', { file_path: join(project, '.env') }, s))
  no(allow('Read', { file_path: join(home, '.ssh', 'id_ed25519') }, s))
  no(allow('Read', { file_path: join(project, 'icon.png') }, s))
  no(allow('Read', { file_path: join(project, '..', '..', '.ssh', 'id_ed25519') }, s))
  no(allow('Read', { file_path: '/etc/passwd' }, s))
  yes(allow('Grep', { pattern: 'TODO', path: project }, s))
  no(allow('Grep', { pattern: 'TOKEN', path: home }, s))
  no(allow('Glob', { pattern: '../../.ssh/*' }, s))
  no(allow('Glob', { pattern: `${home}/.ssh/*` }, s))
  yes(allow('Glob', { pattern: 'src/**/*.ts' }, s))
})

test('chat não escreve, não roda shell e só busca na web em domínio da lista', async () => {
  const { project, s } = await setup()
  no(allow('Write', { file_path: join(project, 'x.md'), content: 'x' }, s))
  no(allow('Edit', { file_path: join(project, 'README.md') }, s))
  no(allow('NotebookEdit', {}, s))
  no(allow('Bash', { command: 'git log' }, s))
  no(allow('AskUserQuestion', {}, s))
  no(allow('Agent', {}, s))
  no(allow('mcp__editr__criar_todos', {}, s))
  yes(allow('mcp__social-grid__criar_post', {}, s))
  yes(allow('Skill', { skill: 'instagram-post-writer' }, s))
  yes(allow('WebFetch', { url: 'https://github.com/valb-mig/mocha' }, s))
  yes(allow('WebFetch', { url: 'https://raw.githubusercontent.com/valb-mig/mocha/main/README.md' }, s))
  no(allow('WebFetch', { url: 'https://evil.com/?k=segredo' }, s))
  no(allow('WebFetch', { url: 'https://api.github.com/repos/x/y' }, s))
  no(allow('WebFetch', { url: 'https://valb.github.io/x' }, s))
  no(allow('WebFetch', { url: 'http://github.com/x' }, s))
})

test('git do chat: log ok; tentativas de escrever arquivo ou executar comando são recusadas', () => {
  const refused = (fn: () => unknown) => assert.throws(fn, (e) => e instanceof Fault && e.code === 'refused')
  assert.deepEqual(gitArgs('log', ['--oneline', '-n', '20']), ['log', '--no-ext-diff', '--no-textconv', '--oneline', '-n', '20'])
  assert.deepEqual(gitArgs('status', ['--short']), ['status', '--ignore-submodules=all', '--short'])
  assert.deepEqual(gitArgs('show', ['HEAD~1', '--stat']), ['show', '--no-ext-diff', '--no-textconv', 'HEAD~1', '--stat'])
  assert.deepEqual(gitArgs('diff', ['main', '--', 'src/app.ts']), ['diff', '--no-ext-diff', '--no-textconv', '--ignore-submodules=all', 'main', '--', 'src/app.ts'])
  refused(() => gitArgs('log', [';', 'rm', '-rf', '/']))
  refused(() => gitArgs('log', ['HEAD;id']))
  refused(() => gitArgs('log', ['$(id)']))
  refused(() => gitArgs('log', ['-c', 'core.pager=sh -c id']))
  refused(() => gitArgs('status', ['-c', 'core.fsmonitor=x']))
  refused(() => gitArgs('diff', ['--output=/tmp/x']))
  refused(() => gitArgs('diff', ['--ext-diff']))
  refused(() => gitArgs('diff', ['--textconv']))
  refused(() => gitArgs('log', ['-C', '/home']))
  refused(() => gitArgs('push', []))
  refused(() => gitArgs('diff', ['--', '../../.ssh/id_ed25519']))
  refused(() => gitArgs('diff', ['--', '/etc/passwd']))
  refused(() => gitArgs('log', ['--format=%H %G? %GS']))
  refused(() => gitArgs('show', ['--pretty=format:%GK']))
})

test('segredos de um projeto real ficam fora do chat pelo hook e pelas regras de deny do SDK', async () => {
  const { home, project, s } = await setup()
  const files = [
    '.env.production',
    '.envrc',
    '.dev.vars',
    '.git/config',
    'infra/prod.tfvars',
    'infra/terraform.tfstate.backup',
    '.claude/settings.local.json',
    'firebase-serviceAccount-prod.json',
    'credentials-gcp.json',
    'kubeconfig-staging',
    '.docker/config.json',
    '.npmrc',
    '.netrc',
    'certs/server.pem',
    'certs/server.key',
    'id_rsa',
    'deploy/id_ed25519.pub',
    'wp-config.php',
    'config/secrets.yml',
  ]
  for (const f of files) {
    await mkdir(join(project, f, '..'), { recursive: true })
    await writeFile(join(project, f), 'SEGREDO')
    assert.equal(secret(join(project, f)), true, f)
    no(allow('Read', { file_path: join(project, f) }, s))
  }
  for (const f of ['src/env.ts', 'docs/secrets-management.md', 'README.md', 'src/keyboard.ts', 'public/credentials.svg', '.github/workflows/ci.yml']) assert.equal(secret(join(project, f)), false, f)
  no(allow('Read', { file_path: join(home, '.aws', 'credentials') }, s))
  no(allow('Grep', { pattern: 'SEGREDO', path: project, glob: '**/.env*' }, s))
  no(allow('Glob', { pattern: '**/.envrc' }, s))
  for (const g of SECRETS) assert.ok(DENY.includes(`Read(**/${g})`) && DENY.includes(`Read(//**/${g})`), g)
  assert.ok(DENY.includes('Bash') && DENY.includes('Write'))
})

test('git do chat recusa repositório com filtro ou programa no .git/config e não roda o filtro', async () => {
  const base = await mkdtemp(join(tmpdir(), 'sg-git-'))
  const repo = join(base, 'repo')
  const mark = join(base, 'marker')
  const sh = (...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: repo })
  await mkdir(repo)
  sh('init', '-q')
  await writeFile(join(repo, 'README.md'), '# repo\n')
  sh('add', 'README.md')
  sh('commit', '-qm', 'primeiro commit')
  assert.match(await git(repo, 'log', ['--oneline']), /primeiro commit/)

  await writeFile(join(repo, '.gitattributes'), '* filter=x\n')
  await writeFile(join(repo, 'README.md'), '# repo mudado\n')
  sh('config', 'filter.x.clean', `touch ${mark}; cat`)
  await assert.rejects(git(repo, 'status', []), (e) => e instanceof Fault && e.code === 'refused' && /filter\.x\.clean/.test(e.message))
  await assert.rejects(git(repo, 'diff', []), (e) => e instanceof Fault && e.code === 'refused')
  assert.equal(existsSync(mark), false)

  sh('config', '--unset', 'filter.x.clean')
  await writeFile(join(repo, '.git', 'extra'), `[gpg]\n\tprogram = ${mark}\n`)
  sh('config', 'include.path', 'extra')
  await assert.rejects(git(repo, 'log', ['-n', '1']), (e) => e instanceof Fault && /gpg\.program/.test(e.message))
  sh('config', '--unset', 'include.path')
  for (const k of ['core.fsmonitor', 'core.hooksPath', 'diff.x.textconv', 'diff.x.command']) {
    sh('config', k, `touch ${mark}`)
    await assert.rejects(git(repo, 'status', []), (e) => e instanceof Fault && e.code === 'refused', k)
    sh('config', '--unset', k)
  }
  assert.match(await readFile(join(repo, '.git', 'config'), 'utf8'), /repositoryformatversion/)
  assert.match(await git(repo, 'status', ['--short']), /README\.md/)
  assert.equal(existsSync(mark), false)
})
