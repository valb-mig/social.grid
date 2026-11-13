import { lstat, open, realpath } from 'node:fs/promises'
import { isAbsolute, sep } from 'node:path'
import { range } from '@social-grid/core/day.ts'
import { Fault, fail } from '@social-grid/core/fault.ts'
import { MAX_BYTES, sniff } from '@social-grid/core/media.ts'
import { ids, nets } from '@social-grid/core/network/index.ts'
import type { Issue } from '@social-grid/core/network/net.ts'
import { total, type Config } from '@social-grid/core/plan/config.ts'
import { open as free, slots } from '@social-grid/core/plan/slots.ts'
import type { Ops, Result } from '@social-grid/core/post/ops.ts'
import { STATUSES, type Changes, type Post } from '@social-grid/core/post/post.ts'
import type { Repo } from '@social-grid/core/post/repo.ts'
import { stats, type Source } from '@social-grid/core/project/project.ts'
import { z } from 'zod'

export type Chat = { project: string; dir: string; made: Set<string> }

export type Ctx = {
  ops: Ops
  repo: Repo
  config: () => Promise<Config>
  projects: Source
  roots: () => Promise<string[]>
  now: () => Date
  chat?: Chat
}

export type Tool = {
  name: string
  description: string
  shape: z.ZodRawShape
  read: boolean
  run(ctx: Ctx, args: unknown): Promise<unknown>
}

function tool<S extends z.ZodRawShape>(
  name: string,
  description: string,
  shape: S,
  read: boolean,
  run: (ctx: Ctx, args: z.infer<z.ZodObject<S>>) => Promise<unknown>,
): Tool {
  const schema = z.object(shape)
  return { name, description, shape, read, run: (ctx, args) => run(ctx, schema.parse(args ?? {})) }
}

export const view = (p: Post) => ({
  id: p.id,
  projeto: p.project,
  rede: p.network,
  formato: p.format,
  ...(p.type ? { tipo: p.type } : {}),
  status: p.status,
  data: p.date,
  hora: p.time,
  titulo: p.title,
  legenda: p.caption,
  hashtags: p.hashtags,
  midia: p.media,
  comentario: p.comment,
  postado_em: p.postedAt,
  atualizado_em: p.updatedAt,
  ...(p.archived ? { arquivado: true } : {}),
})

const notes = (list: Issue[]) => list.filter((i) => i.level !== 'ok').map((i) => `${i.level === 'error' ? 'erro' : 'aviso'}: ${i.text}`)

const out = (r: Result) => ({ post: view(r.post), avisos: notes(r.issues) })

const day = z.string().describe('YYYY-MM-DD')
const formats = nets.map((n) => `${n.id}: ${n.formats.map((f) => f.id).join(', ')}`).join('; ')

async function inside(path: string, roots: string[], where: string): Promise<string> {
  if (!isAbsolute(path)) fail('invalid', 'use o caminho absoluto do arquivo')
  const st = await lstat(path).catch(() => null)
  if (!st) fail('not_found', `arquivo não encontrado: ${path}`)
  if (st.isSymbolicLink()) fail('refused', 'link simbólico não é aceito')
  if (!st.isFile()) fail('invalid', 'não é um arquivo')
  if (st.size > MAX_BYTES) fail('too_large', 'arquivo maior que 100 MB')
  const real = await realpath(path)
  const bases = await Promise.all(roots.map((r) => realpath(r).catch(() => null)))
  if (!bases.some((b) => b && real.startsWith(b + sep))) fail('refused', `o arquivo precisa estar ${where}`)
  return real
}

async function mine(ctx: Ctx, id: string): Promise<void> {
  const c = ctx.chat
  if (!c) return
  const { post } = await ctx.ops.get(id)
  if (post.project !== c.project && !c.made.has(post.id)) fail('refused', `o post ${id} é de outro projeto; nesta conversa só dá para mexer nos posts de ${c.project}`)
}

async function kind(path: string): Promise<string> {
  const fh = await open(path, 'r')
  try {
    const buf = Buffer.alloc(32)
    const { bytesRead } = await fh.read(buf, 0, 32, 0)
    return sniff(buf.subarray(0, bytesRead)) ?? fail('invalid', 'só imagem (jpg, png, webp, gif) ou vídeo (mp4, mov, webm)')
  } finally {
    await fh.close()
  }
}

export const tools: Tool[] = [
  tool('listar_projetos', 'Lista os projetos (repositórios git da pasta de projetos e "geral") com atividade no git e contagem de posts por status.', {}, true, async (ctx) => {
    const [list, posts] = await Promise.all([ctx.projects.list(), ctx.repo.list()])
    return list.map((p) => {
      const s = stats(p, posts)
      return {
        id: p.id,
        nome: p.name,
        pasta: p.path,
        sobre: p.about,
        ultimo_commit: p.last,
        commits_7d: p.week,
        commits_30d: p.month,
        rascunhos: s.draft,
        prontos: s.ready,
        postados: s.posted,
        sem_divulgacao: s.quiet,
      }
    })
  }),

  tool('ler_config', 'Lê a config: redes ligadas e handles, regras de frequência (dias 0=seg a 6=dom e horários), hashtags padrão, skills e avisos.', {}, true, async (ctx) => {
    const cfg = await ctx.config()
    return { ...cfg, posts_por_semana: total(cfg) }
  }),

  tool(
    'listar_posts',
    'Lista os posts com data no intervalo (até 93 dias). Filtra por projeto e status; sem_data inclui os posts ainda sem data.',
    {
      de: day,
      ate: day,
      projeto: z.string().max(100).optional(),
      status: z.enum(STATUSES).optional(),
      sem_data: z.boolean().optional(),
    },
    true,
    async (ctx, a) => {
      const [from, to] = range(a.de, a.ate)
      const all = await ctx.repo.list()
      return all
        .filter((p) => !p.archived)
        .filter((p) => (p.date ? p.date >= from && p.date <= to : !!a.sem_data))
        .filter((p) => !a.projeto || p.project === a.projeto)
        .filter((p) => !a.status || p.status === a.status)
        .slice(0, 300)
        .map(view)
    },
  ),

  tool('ler_post', 'Lê um post pelo id, com os avisos da rede.', { id: z.string().max(100) }, true, async (ctx, a) => out(await ctx.ops.get(a.id))),

  tool('listar_slots', 'Horários que a config de frequência pede e ainda estão sem post, no intervalo (até 93 dias).', { de: day, ate: day }, true, async (ctx, a) => {
    const [from, to] = range(a.de, a.ate)
    const [cfg, posts] = await Promise.all([ctx.config(), ctx.repo.list()])
    return free(slots(cfg, from, to, posts)).map((s) => ({ data: s.date, hora: s.time, rede: s.net, formato: s.format }))
  }),

  tool(
    'criar_post',
    'Cria um post em rascunho. As hashtags padrão da config entram junto. Devolve o post e os avisos da rede.',
    {
      projeto: z.string().max(100).describe('id do projeto (listar_projetos) ou "geral"'),
      rede: z.enum(ids),
      formato: z.string().max(32).describe(formats),
      tipo: z.string().max(60).optional().describe('tipo de post da skill, em minúsculas (ex.: bastidores técnico, projeto grande, post único)'),
      titulo: z.string().min(1).max(140).describe('nome curto do post, aparece na agenda'),
      legenda: z.string().max(10_000).describe('texto do post, sem as hashtags'),
      hashtags: z.array(z.string().max(80)).max(40).describe('sem #'),
      data: day.optional().describe('YYYY-MM-DD; sem data o post fica em "sem data"'),
      hora: z.string().optional().describe('HH:MM'),
      comentario: z.string().max(3000).optional().describe('primeiro comentário; no LinkedIn é onde vai o link'),
    },
    false,
    async (ctx, a) => {
      const r = await ctx.ops.create({
          project: a.projeto,
          network: a.rede,
          format: a.formato,
          type: a.tipo,
          title: a.titulo,
          caption: a.legenda,
          hashtags: a.hashtags,
          date: a.data ?? null,
          time: a.hora ?? null,
          comment: a.comentario,
        })
      ctx.chat?.made.add(r.post.id)
      return out(r)
    },
  ),

  tool(
    'editar_post',
    'Muda campos de um post. Mande só o que muda. status move entre draft, ready e posted. atualizado_em (o que você leu) evita apagar uma mudança feita no app ao mesmo tempo.',
    {
      id: z.string().max(100),
      atualizado_em: z.string().max(40).optional(),
      titulo: z.string().min(1).max(140).optional(),
      legenda: z.string().max(10_000).optional(),
      hashtags: z.array(z.string().max(80)).max(40).optional(),
      data: day.nullable().optional().describe('null tira a data'),
      hora: z.string().nullable().optional(),
      comentario: z.string().max(3000).optional(),
      rede: z.enum(ids).optional(),
      formato: z.string().max(32).optional(),
      tipo: z.string().max(60).optional(),
      projeto: z.string().max(100).optional(),
      ordem_midia: z.array(z.string().max(100)).max(20).optional().describe('nomes da mídia na ordem nova'),
      status: z.enum(STATUSES).optional(),
    },
    false,
    async (ctx, a) => {
      if (ctx.chat && a.status === 'posted') fail('refused', 'marcar como postado é coisa do usuário, no app, depois que ele publicar')
      await mine(ctx, a.id)
      const c: Changes = {}
      if (a.titulo !== undefined) c.title = a.titulo
      if (a.legenda !== undefined) c.caption = a.legenda
      if (a.hashtags !== undefined) c.hashtags = a.hashtags
      if (a.data !== undefined) c.date = a.data
      if (a.hora !== undefined) c.time = a.hora
      if (a.comentario !== undefined) c.comment = a.comentario
      if (a.rede !== undefined) c.network = a.rede
      if (a.formato !== undefined) c.format = a.formato
      if (a.tipo !== undefined) c.type = a.tipo
      if (a.projeto !== undefined) c.project = a.projeto
      if (a.ordem_midia !== undefined) c.media = a.ordem_midia
      let base = a.atualizado_em
      let r: Result | null = null
      if (Object.keys(c).length) {
        r = await ctx.ops.patch(a.id, c, base)
        base = undefined
      }
      if (a.status) r = await ctx.ops.move(a.id, a.status, base)
      return out(r ?? (await ctx.ops.get(a.id)))
    },
  ),

  tool(
    'anexar_midia',
    'Copia uma imagem ou um vídeo (caminho absoluto, dentro da pasta de projetos ou do vault, até 100 MB) para o post, no fim da lista de mídia.',
    { id: z.string().max(100), caminho: z.string().max(1024) },
    false,
    async (ctx, a) => {
      await mine(ctx, a.id)
      const real = ctx.chat
        ? await inside(a.caminho, [ctx.chat.dir], 'na pasta do projeto desta conversa')
        : await inside(a.caminho, await ctx.roots(), 'na pasta de projetos ou no vault')
      const r = await ctx.ops.attach(a.id, real, await kind(real))
      return { ...out(r), arquivo: r.name, ...(r.grew ? { formato_novo: 'o feed virou carrossel porque agora tem mais de uma mídia' } : {}) }
    },
  ),
]

export const find = (name: string) => tools.find((t) => t.name === name)

export type Reply = { content: { type: 'text'; text: string }[]; isError?: boolean }

export async function reply(fn: () => Promise<unknown>): Promise<Reply> {
  try {
    const data = await fn()
    return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] }
  } catch (err) {
    const text = err instanceof Fault ? err.message : err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : 'falha interna'
    return { content: [{ type: 'text', text: `Erro: ${text}` }], isError: true }
  }
}
