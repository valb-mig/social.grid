import { mkdir, readdir, realpath } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { make, type Input, type Post, type Status } from '@social-grid/core/post/post.ts'
import { home, open } from '@social-grid/vault/open.ts'

const target = process.env.SOCIAL_GRID_VAULT
if (!target) {
  console.error('Defina SOCIAL_GRID_VAULT com a pasta do vault de exemplo, por exemplo: SOCIAL_GRID_VAULT=/tmp/sg-exemplo pnpm seed')
  process.exit(1)
}

const dir = resolve(target)
const main = resolve(home(), 'SocialGrid')
const mains = new Set([main, await realpath(main).catch(() => main)])
const refuse = (p: string) => {
  if (!mains.has(p)) return
  console.error('Recusado: o exemplo nunca escreve no ~/SocialGrid.')
  process.exit(1)
}
refuse(await realpath(dir).catch(() => dir))
await mkdir(dir, { recursive: true })
const real = await realpath(dir)
refuse(real)
if ((await readdir(real)).length) {
  console.error(`Recusado: ${real} não está vazia.`)
  process.exit(1)
}

const v = open(real)
const slides = ['slide-1.jpg', 'slide-2.jpg', 'slide-3.jpg'].map((f) => join(import.meta.dirname, 'seed', f))

await v.cfg.save({
  nets: { instagram: { on: true, handle: '@valb.dev' }, linkedin: { on: true, handle: 'in/valb-mig' } },
  tags: { nets: { instagram: ['buildinpublic', 'devbrasil'], linkedin: ['buildinpublic'] }, projects: { 'mocha.app': ['designsystem', 'mcp'] } },
})

type Seed = Input & { status: Status; media?: number[]; postedAt?: string }

const at = (d: string, t = '12:00') => new Date(`${d}T${t}:00`).toISOString()

const mocha = `Seu design ainda mora em print solto no WhatsApp? 🫠

Eu vivia isso: referência num lugar, paleta noutro, e a tela final num Figma que ninguém abria de novo.

Aí fiz o mocha. Cada ideia vira uma pasta: briefing em markdown, com as imagens coladas no texto, e o blend, que é o design em HTML puro, versionado v1, v2, v3.

O melhor: o Claude lê o briefing pelo MCP e monta o blend sozinho. Eu reviso, ele ajusta. ☕

Arrasta pro lado pra ver o fluxo inteiro 👉 Você guarda suas referências onde?`

const seeds: Seed[] = [
  { project: 'mocha.app', network: 'linkedin', format: 'post', type: 'projeto grande', title: 'Lançamento do mocha', caption: 'Lancei o mocha: design de aplicações web organizado por ideia, rodando na sua máquina.', hashtags: ['ia', 'webdesign', 'opensource'], date: '2026-10-28', time: '08:30', status: 'posted' },
  { project: 'mocha.app', network: 'instagram', format: 'feed', type: 'post único', title: 'Briefing estilo Obsidian', caption: 'Briefing em markdown, com as imagens coladas no meio do texto.', hashtags: ['obsidian', 'webdesign', 'produtividade', 'designsystem', 'markdown', 'indiedev', 'typescript', 'opensource'], date: '2026-10-30', time: '12:00', status: 'posted', media: [1] },
  { project: 'editr', network: 'instagram', format: 'feed', title: 'Claude Code no celular', caption: 'Aprovo o que o Claude faz no PC direto do celular.', hashtags: ['claudecode', 'ia', 'devlife', 'pwa', 'tailscale', 'indiedev', 'typescript', 'opensource'], date: '2026-11-02', time: '12:00', status: 'posted', media: [0] },
  { project: 'editr', network: 'linkedin', format: 'post', type: 'bastidores técnico', title: 'Por que fiz o edit.r', caption: 'Eu queria acompanhar as sessões do Claude Code longe do PC. Virou o edit.r.', hashtags: ['ia', 'produtividade', 'claudecode'], date: '2026-11-03', time: '08:30', status: 'posted' },
  { project: 'mindblow.app', network: 'instagram', format: 'feed', title: 'Mapa mental em 10 segundos', caption: 'Uma ideia solta vira mapa antes do café esfriar.', hashtags: ['mindmap', 'produtividade', 'ia', 'indiedev', 'devbrasil', 'pwa', 'react', 'opensource'], date: '2026-11-04', time: '12:00', status: 'posted', media: [2] },
  { project: 'mindblow.app', network: 'linkedin', format: 'post', title: 'Offline primeiro', caption: 'O mindblow funciona sem internet. Explico por que isso mudou o produto.', hashtags: ['offlinefirst', 'pwa', 'react'], date: '2026-11-05', time: '08:30', status: 'posted' },
  { project: 'dumb.db', network: 'instagram', format: 'feed', title: 'Um client de banco que não atrapalha', caption: 'MySQL, Postgres e SQLite numa tela só, com permissões para o agente.', hashtags: ['mysql', 'postgres', 'sqlite', 'tauri', 'rust', 'devbrasil', 'indiedev', 'opensource'], date: '2026-11-06', time: '12:00', status: 'posted', media: [0] },
  { project: 'desktop.ato20', network: 'instagram', format: 'story', title: 'Bastidores do ato20', caption: '', hashtags: [], date: '2026-11-06', time: '19:00', status: 'posted', media: [1] },
  { project: 'ecoa.desktop', network: 'instagram', format: 'feed', title: 'ecoa: áudio do jeito certo', caption: 'Gravei, cortei e mandei sem abrir três programas.', hashtags: ['audio', 'electron', 'indiedev', 'devbrasil', 'podcast', 'typescript', 'opensource', 'buildinpublic'], date: '2026-11-09', time: '12:00', status: 'posted', media: [2] },
  { project: 'editr', network: 'linkedin', format: 'post', title: 'Notificação que chega na hora', caption: 'Web Push pela tailnet, sem nuvem no meio.', hashtags: ['webpush', 'tailscale', 'pwa'], date: '2026-11-10', time: '08:30', status: 'posted' },
  { project: 'desktop.ato20', network: 'instagram', format: 'feed', title: 'ato20 na versão 2', caption: 'A versão 2 do ato20 saiu com tema escuro e atalhos novos.', hashtags: ['desktop', 'linux', 'indiedev', 'devbrasil', 'opensource', 'typescript', 'electron', 'release'], date: '2026-11-11', time: '12:00', status: 'posted', media: [0] },
  { project: 'dumb.db', network: 'linkedin', format: 'post', title: 'Migração entre conexões', caption: 'Copiar tabelas de prod para o local virou uma tela no dumb.db.', hashtags: ['database', 'devtools', 'opensource'], date: '2026-11-12', time: '08:30', status: 'posted' },
  { project: 'mocha.app', network: 'instagram', format: 'carrossel', title: 'Carrossel do mocha', caption: mocha, hashtags: ['buildinpublic', 'devbrasil', 'webdesign', 'designsystem', 'claudecode', 'mcp', 'typescript', 'indiedev', 'opensource'], date: '2026-11-13', time: '12:00', status: 'ready', media: [0, 1, 2] },
  { project: 'editr', network: 'instagram', format: 'story', title: 'Story de bastidores', caption: '', hashtags: [], date: '2026-11-13', time: '19:00', status: 'draft' },
  { project: 'mindblow.app', network: 'instagram', format: 'feed', title: 'Notas que funcionam sem internet', caption: 'Avião, metrô, sítio do avô: o mindblow continua anotando.', hashtags: ['offlinefirst', 'pwa', 'produtividade'], date: '2026-11-16', time: '12:00', status: 'draft' },
  { project: 'mocha.app', network: 'linkedin', format: 'post', type: 'bastidores técnico', title: 'Por que o blend é HTML puro', caption: 'O design do mocha é HTML puro, sem build. Parece passo atrás, mas é o que deixa qualquer agente ler, editar e reimplementar a tela noutra stack.\n\nTrês motivos, nos comentários eu deixo o repositório.', hashtags: ['webdesign', 'html', 'ia', 'buildinpublic'], comment: 'https://github.com/valb-mig/mocha.app', date: '2026-11-19', time: '08:30', status: 'ready' },
  { project: 'ecoa.desktop', network: 'linkedin', format: 'post', title: 'O que aprendi com áudio no Electron', caption: 'Latência, buffers e um bug que só aparecia às sextas.', hashtags: ['electron', 'audio', 'javascript'], date: '2026-11-24', time: '08:30', status: 'draft' },
  { project: 'mocha.app', network: 'instagram', format: 'reels', title: 'Reels: agente editando o blend ao vivo', caption: 'O Claude mexendo no blend enquanto eu falo o que quero.', hashtags: ['claudecode', 'webdesign', 'ia'], status: 'draft' },
]

for (const s of seeds) {
  const now = new Date(at(s.date ?? '2026-11-01', s.time ?? '10:00'))
  const created = await v.repo.create(make(s, new Date(now.getTime() - 3 * 864e5)))
  const media: string[] = []
  for (const i of s.media ?? []) media.push(await v.repo.attach(created.id, slides[i]!, 'jpg'))
  await v.repo.update(created.id, (p): Post => ({
    ...p,
    media,
    status: s.status,
    postedAt: s.status === 'posted' ? now.toISOString() : null,
    updatedAt: new Date(now.getTime() - 864e5).toISOString(),
  }))
}

console.log(`Vault de exemplo com ${seeds.length} posts em ${real}`)
console.log(`Rode: SOCIAL_GRID_VAULT=${real} SOCIAL_GRID_STATE=${real}.state pnpm start`)
