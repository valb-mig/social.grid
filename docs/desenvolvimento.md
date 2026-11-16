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
| `SOCIAL_GRID_TAILSCALE` | `tailscale` (o binário que o app chama) |
| `SOCIAL_GRID_CHROME` | o primeiro de `google-chrome-stable`, `google-chrome`, `chromium` e `chromium-browser` no PATH (o `gerar_imagem` usa) |
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
- vault: excluir rascunho move a pasta com a mídia para `.lixeira`, emite `gone` e a segunda vez é `not_found`; exclusão espera a edição em andamento no mesmo post;
- watch: edição à mão e pasta nova emitem 1 evento, escrita do próprio app não duplica; exclusão pelo app não emite de novo e pasta apagada à mão emite `gone`;
- MCP: a lista de ferramentas é fechada e nenhuma exclui post; `criar_post` grava e emite no bus; `anexar_midia` recusa arquivo de fora; no contexto do chat, post de outro projeto, status postado e arquivo de fora do projeto são recusados;
- skills numa HOME temporária, com `../`, nome fora da lista, link simbólico e exclamação seguida de crase recusados;
- guard (Host, origem, tipo do corpo, WebSocket, login da tailnet), `DELETE` sem `Origin`, de outra origem ou de outra conta da tailnet recusado, inscrição de push e a pílula com o aparelho conectado pela tailnet;
- WebSocket: post excluído no PC chega como `gone` na segunda conexão (o celular);
- relógio de verdade com timers simulados: liga às 11:44:30, roda na virada do minuto e avisa uma vez;
- rotas com `fastify.inject`: excluir move a pasta para `.lixeira`, emite `gone`, libera o slot e o post some da API; listar por intervalo, upload com mime proibido e SVG disfarçado, imagem do chat;
- política do chat: leitura fora do projeto, a lista de segredos, escrita, shell, WebFetch fora da lista, git com opções perigosas e repositório com filtro no `.git/config`;
- chat com o Claude Code de verdade contra uma API falsa local (`apps/server/test/claude.ts`), numa HOME temporária: hook do `.claude/settings.json` do repositório não roda, `Grep` sem caminho não devolve `.env`, `Read` do `.envrc` é negado, erro sem login em português, e conversa que reabre depois do servidor reiniciar com epoch novo, sem perder mensagem nem o cartão do post;
- gerar_imagem com o Chrome de verdade (pulado sem Chrome): PNG no tamanho do formato (feed, story e `quadrado`), com o canto na cor do fundo; HTML com script, `meta refresh` para um arquivo do PC, CSS, imagem e iframe de um servidor local e de `file://` sai com o fundo intacto e o servidor sem nenhum acesso; reels, post de outro projeto no chat e HTML gigante recusados sem abrir o Chrome; sem Chrome, erro claro;
- link da tailnet, com o `tailscale status` e o `serve status` reais (anonimizados) e um exec falso: a 8443 já no app não escreve nada, 8443 livre publica com os args exatos e libera o celular no guard na hora, 8443 de outro serviço não é sobrescrita, falta de operator vira o comando com o usuário, HTTPS ou MagicDNS desligados não tentam publicar, Tailscale ausente ou parado, só os celulares do dono, boot que publica uma vez (e espera o Tailscale subir), `POST /api/link` pela tailnet 403 e o `PUT /api/config` sem poder mexer no link;
- app web: a store ignora evento de conversa não aberta, recarrega tudo quando o epoch muda e tira o post ao receber `gone` (ou quando o GET dele volta 404).

## Release

A branch `release` é a das versões: cada push nela roda o workflow `Release` (`.github/workflows/release.yml`), que confere os tipos, roda os testes, compila o web e publica nos Releases do GitHub o `social-grid.tar.gz` e o `install.sh`. Os PRs passam pelas mesmas etapas, sem publicar. Commits na `main` não publicam nada.

```sh
git push origin main:release
```

- **Versão:** a seguinte à última tag `v*` no patch (`v0.1.3` vira `0.1.4`). Para subir a minor ou a major, ponha a versão nova no `version` do `package.json` da raiz; maior que a última tag, ela vale (`deploy/version.ts`).
- **Pacote:** `deploy/pack.sh` junta o código do servidor e dos pacotes, o web já compilado e o lockfile, sem `node_modules` nem testes, com a versão no arquivo `VERSION`. Fica em `release/social-grid.tar.gz`, ao lado de uma cópia do `install.sh` com a versão fixada, que é a que vai para a release: o `install.sh` de uma release sempre instala o pacote da mesma release, mesmo que o `latest` do GitHub ainda aponte para a anterior logo depois de publicar.
- **Instalador:** `deploy/install.sh` rodado pelo `curl` baixa a release para `~/.local/opt/social-grid` (ou `SOCIAL_GRID_HOME`), instala só as dependências de produção do servidor, troca a pasta e reinicia o serviço. Rodado de dentro de um clone, compila e instala o próprio clone. Nos dois casos põe o ícone no tema `hicolor` do usuário e o atalho `social-grid.desktop`, que abre o `deploy/app.sh`: o Chrome em modo app, com um perfil próprio (`social-grid`). No Wayland o Chrome ignora o `--class` e monta o id da janela com o host e o perfil (`chrome-localhost__-social-grid`); é esse id que vai no `StartupWMClass`, para a barra juntar a janela ao ícone.
- **Falha:** se o workflow quebrar depois de criar a tag, ele apaga a release pela metade e a tag, e a versão não fica pulada.

## Padrões do código

- Sem comentários em nenhum arquivo.
- Nomes curtos; a pasta e o arquivo dão o contexto (`plan/slots.ts` exporta `slots`, `post/status.ts` exporta `move`).
- TypeScript com `erasableSyntaxOnly` (sem enum, namespace nem parameter properties) e imports com `.ts`.
- Textos da interface e docs em pt-br, sem travessão.
