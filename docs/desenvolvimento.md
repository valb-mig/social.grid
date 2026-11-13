# Desenvolvimento e testes

Node 26 (roda TypeScript direto, sem build no servidor) e pnpm 11.

## Scripts

| comando | o que faz |
| --- | --- |
| `pnpm dev` | servidor com `--watch` em `:7338` e Vite em `:5173`, com proxy de `/api` e `/ws` |
| `pnpm build` | compila o app web em `apps/web/dist` |
| `pnpm start` | servidor servindo o `dist` em `127.0.0.1:7338` |
| `pnpm test` | todos os testes (`node --test`, fuso `America/Sao_Paulo`) |
| `pnpm check` | `tsc` em todos os pacotes, web inclusive |
| `pnpm mcp` | servidor MCP stdio |
| `pnpm seed` | vault de exemplo com os posts de novembro de 2026 |

Em dev o servidor roda com `SOCIAL_GRID_DEV=1`, que libera o Host e a origem do Vite (`localhost:5173`). O guard continua ligado.

## Variáveis

| variável | padrão |
| --- | --- |
| `SOCIAL_GRID_VAULT` | `~/SocialGrid` |
| `SOCIAL_GRID_STATE` | `~/.local/state/social-grid` |
| `SOCIAL_GRID_PORT` | `7338` |
| `SOCIAL_GRID_SERVE_PORT` | `8443` (porta https do `tailscale serve`) |
| `SOCIAL_GRID_LOGINS` | o dono do nó do Tailscale |

## Vault de exemplo

O seed exige `SOCIAL_GRID_VAULT`, recusa `~/SocialGrid` e pasta que não esteja vazia:

```sh
SOCIAL_GRID_VAULT=/tmp/sg-exemplo pnpm seed
SOCIAL_GRID_VAULT=/tmp/sg-exemplo SOCIAL_GRID_STATE=/tmp/sg-exemplo.state pnpm start
```

## Testes

Ficam em `packages/*/test` e `apps/*/test`, com cenários de uso real:

- slots da semana de 16/11 a partir da config e um post agendado ocupando o slot;
- máquina de status com hashtags demais, carrossel com 1 mídia, LinkedIn longo e link no corpo;
- pacote do carrossel na ordem salva;
- lembretes: pronto às 11:45, rascunho das 08:00 avisado às 07:45, post das 00:10 avisado às 23:55 da véspera;
- vault: criar, anexar, mudar a data e reler do disco; frontmatter sem injeção; conflito por `updatedAt`; edições simultâneas; `post.md` sem cada campo e mínimo escrito à mão; feed que vira carrossel e 21ª mídia recusada sem deixar arquivo;
- watch: edição à mão e pasta nova emitem 1 evento, escrita do próprio app não duplica;
- MCP: `criar_post` grava e emite no bus; `anexar_midia` recusa arquivo de fora; no contexto do chat, post de outro projeto, status postado e arquivo de fora do projeto são recusados;
- skills numa HOME temporária, com `../`, nome fora da lista, link simbólico e exclamação seguida de crase recusados;
- guard (Host, origem, tipo do corpo, WebSocket, login da tailnet), inscrição de push e a pílula com o aparelho conectado pela tailnet;
- relógio de verdade com timers simulados: liga às 11:44:30, roda na virada do minuto e avisa uma vez;
- rotas com `fastify.inject`: listar por intervalo, upload com mime proibido e SVG disfarçado, imagem do chat;
- política do chat: leitura fora do projeto, a lista de segredos, escrita, shell, WebFetch fora da lista, git com opções perigosas e repositório com filtro no `.git/config`;
- chat com o Claude Code de verdade contra uma API falsa local (`apps/server/test/claude.ts`), numa HOME temporária: hook do `.claude/settings.json` do repositório não roda, `Grep` sem caminho não devolve `.env`, `Read` do `.envrc` é negado, erro sem login em português, e conversa que reabre depois do servidor reiniciar com epoch novo, sem perder mensagem nem o cartão do post;
- app web: a store ignora evento de conversa não aberta e recarrega tudo quando o epoch muda.

## Padrões do código

- Sem comentários em nenhum arquivo.
- Nomes curtos; a pasta e o arquivo dão o contexto (`plan/slots.ts` exporta `slots`, `post/status.ts` exporta `move`).
- TypeScript com `erasableSyntaxOnly` (sem enum, namespace nem parameter properties) e imports com `.ts`.
- Textos da interface e docs em pt-br, sem travessão.
