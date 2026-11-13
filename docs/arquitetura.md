# Arquitetura

Um processo Node no PC (Fastify em `127.0.0.1:7338`) serve a API, o WebSocket e o app web já compilado. Os dados são arquivos no vault (`~/SocialGrid`); o estado interno do servidor fica em `~/.local/state/social-grid`. O celular chega pelo `tailscale serve`.

## Pacotes

```
packages/core    domínio puro: posts, redes, agenda, lembretes, projetos (sem fs nem rede; roda no navegador)
packages/vault   adaptadores de arquivo: posts e config no vault, projetos git da pasta de projetos, watch
packages/mcp     ferramentas MCP compartilhadas e o servidor stdio para o Claude Code do terminal
apps/server      HTTP, WebSocket, chat (Agent SDK), skills, push, relógio dos lembretes
apps/web         React + Vite + Tailwind, PWA com service worker próprio
```

Dependências permitidas:

- `core` não importa nenhum outro pacote do projeto.
- `vault` e `mcp/tools.ts` dependem só de `core`. `mcp/stdio.ts` monta o contexto com o `vault`.
- `server` depende de `core`, `vault` e `mcp`.
- `web` fala com o servidor só por HTTP e WebSocket, e importa o `core` inteiro (tipos e funções puras), nunca `vault`, `mcp` ou `server`. Assim a validação ao vivo, o corte do "mais", os limites de hashtags e os slots tracejados usam o mesmo código do servidor, sem ida ao PC a cada tecla.

## Domínio (core)

- `day.ts`: datas `YYYY-MM-DD` e horas `HH:MM` locais (America/Sao_Paulo, o fuso do PC). Toda função que depende de hoje recebe `now`; o core nunca chama `new Date()` sozinho.
- `post/post.ts`: o tipo `Post`, criação (`make`), mudança (`patch`), slug do id e normalização de hashtags.
- `post/status.ts`: máquina de status pura, `move(post, para, { now, issues })`. Rascunho vai a pronto só sem erro da rede; pronto volta a rascunho; postado é final e só volta a pronto no mesmo dia. Postado grava `postedAt`.
- `post/ops.ts`: casos de uso (`create`, `patch`, `move`, `attach`, `remove`, `get`). Recebem as portas (`Repo`, leitura da config, `Bus`, `now`, checagem de projeto). Aplicam as hashtags padrão, validam rede e formato, rodam o `check` da rede, mudam o status e emitem no bus. `attach` confere o limite de mídias dentro do lock do post (e apaga a cópia se passar) e troca o formato quando a rede manda (feed do Instagram com 2 mídias ou mais vira carrossel). `remove` pede ao `Repo` para tirar o post (o vault move a pasta para a lixeira) e emite `gone`. As rotas HTTP e as ferramentas MCP são adaptadores finos sobre eles; o MCP não usa `remove`.
- `network/*`: Strategy por rede. Cada uma tem formatos, limites e `check(post)` (erro, aviso ou ok) e `pack(post)` (mídia na ordem, legenda, hashtags com #, comentário). O registro (`network/index.ts`) é a fonte dos ids: a config, o zod das ferramentas e a validação de formato derivam dele, então uma rede nova é um arquivo novo mais uma linha no registro.
- `plan/config.ts`: tipo, defaults e schema zod da config. Nomes de skills e agentes têm regex, listas têm tamanho máximo.
- `plan/slots.ts`: `slots(config, de, ate, posts)` transforma as regras de frequência em slots e marca os preenchidos. Carrossel ocupa o slot de feed.
- `plan/remind.ts`: `due(posts, config, agora, enviados)` decide os avisos: pronto na janela `[hora - N min, hora)`, mesmo quando ela começa no dia anterior (post das 00:10 avisa às 23:55), e rascunho a partir do que vier antes entre o horário da config e `hora - N min`, só enquanto a hora do post não passou. É função pura; o relógio só agenda.
- `project/project.ts`: tipo `Project`, porta `Source` e `stats(projeto, posts)` (contadores e "Sem divulgação").
- `bus.ts`: Observer tipado criado por fábrica (`bus()`), um por processo, injetado no servidor, no MCP do chat e nos testes.

## Eventos ao vivo

Regra única: quem escreve emite. O `ops` emite `post { id }` logo depois de gravar e `gone { id }` logo depois de mover o post para a lixeira. O `watch.ts` observa `posts/` e `config.json` para pegar o que vem de fora (o MCP stdio em outro processo ou edição manual) e ignora o que o próprio processo gravou: o repositório guarda o `mtime` da última escrita de cada post (ou a marca de removido) e o watcher compara antes de emitir. Se a pasta ou o `post.md` sumiu, o watcher emite `gone`; senão, `post`. Arquivos `.tmp` da escrita atômica também são ignorados. O evento leva só o id: com `post` o app refaz o GET daquele post, com `gone` ele tira o post da store (e o editor aberto daquele post mostra que ele não existe mais), então um evento repetido não faz mal.

## Concorrência

- Escrita atômica (tmp + rename) em um helper só (`vault/atomic.ts`), usado pelo vault e pelo estado do servidor.
- Mutex por post dentro do processo (cadeia de Promise por id): autosave da legenda e reordenação da mídia não se atropelam.
- Concorrência otimista entre processos: PATCH e `editar_post` mandam o `updatedAt` que leram; se o disco mudou, a API responde 409 e o agente recebe erro em texto. O `updatedAt` sempre cresce, mesmo com duas edições no mesmo milissegundo.
- Upload e `anexar_midia` copiam o arquivo primeiro e só depois gravam o frontmatter.
- Não há fila externa nem worker: é um usuário só e centenas de posts no máximo. Leitura e escrita usam o mesmo `Repo` (sem CQRS), com cache por `mtime`.

## Chat

`apps/server/src/chat/`:

- `policy.ts`: decisão pura `allow(ferramenta, entrada, escopo)`. Liberado: `Read`, `Glob` e `Grep` dentro do projeto, do vault e de `~/.claude/skills|agents` (com realpath), `Skill`, `WebSearch`, `WebFetch` só para os hosts exatos da lista (sem subdomínio) e as ferramentas do MCP do social.grid. O resto é negado. `SECRETS` é a lista única de padrões de segredo (`.env*`, `.envrc`, `.dev.vars`, `.git/config`, `*.tfvars`, `*.tfstate*`, `.claude/settings.local.json`, chaves, credenciais e afins): dela saem a regex do hook e as regras `Read(**/padrão)` e `Read(//**/padrão)` passadas em `disallowedTools`, que o Claude Code aplica também ao `Grep` sem caminho. `gitArgs` valida o git do chat: só `log`, `show`, `diff` e `status`, opções numa lista fechada, sem `%G` no formato, refs sem metacaractere e caminhos depois de `--`.
- `git.ts`: antes de rodar, lê `git config --local --includes` e recusa o repositório que configura `filter.*`, `gpg.*`, `diff.*.command`, `diff.*.textconv`, `diff.external`, `core.fsmonitor` ou `core.hooksPath`. Todo git do app roda com `-c core.fsmonitor=false -c gpg.program=false` (e os `gpg.*.program`), sem pager, e o do chat com `--no-ext-diff --no-textconv --ignore-submodules=all` onde o subcomando aceita.
- `session.ts`: uma conversa viva no Agent SDK. `query()` com prompt em fila (`queue.ts`), `cwd` na pasta do projeto, `settingSources: ['user']` (nada do `.claude/` do repositório: hooks, env, skills e CLAUDE.md dele não carregam), `permissionMode: 'default'`, `tools` explícito, `disallowedTools` com escrita, shell, subagentes, `AskUserQuestion` e as regras de segredo, `strictMcpConfig` só com o MCP embutido e um hook `PreToolUse` que aplica a política em toda chamada (ele vence as regras de allow do usuário e o hook de aprovação remota). Cada sessão viva tem um `epoch` próprio. O MCP embutido usa o mesmo `ops` e o mesmo bus do servidor, então o post criado pelo chat aparece na hora.
- `hub.ts`: sessões guardadas no estado (só ids criados aqui, em UUID), no máximo 2 vivas, fechamento por inatividade, histórico lido do transcript ao retomar (com os cartões de post criado e os erros) e buffer de eventos com `seq`. O `seq` recomeça quando a sessão reabre, então todo evento leva o `epoch`: se o app vê um epoch diferente do que tem, recarrega a conversa inteira. Eventos de conversa que o app não abriu são ignorados; abrir carrega do começo.
- `pics.ts`: imagens anexadas no chat, guardadas no estado (`pics/`, nome pelo hash do conteúdo, até 5 MB e 4 por mensagem) e mandadas ao Agent SDK como bloco de imagem na mensagem do usuário.
- `prompt.ts`: o append do system prompt é `mcp/instructions.ts` mais o contexto do momento (data, id e pasta do projeto, slots vazios da semana e regras da conversa). Nada do README entra no prompt: o agente lê o README com `Read` se precisar.

Enviar uma mensagem só põe na fila e responde 202; a resposta sai pelo WebSocket.

## Modelo de confiança

- O PC é confiável: quem tem shell no PC já tem tudo. O servidor escuta só em `127.0.0.1` e só atende o Host local.
- A tailnet não é confiável por si: pelo `tailscale serve`, só passa o pedido com o `Tailscale-User-Login` do dono do nó (ou das contas de `SOCIAL_GRID_LOGINS`). Outro aparelho ou outra conta da tailnet recebe 403, inclusive no WebSocket.
- O conteúdo dos repositórios não é confiável: README, código, histórico do git, páginas da web e o `.claude/` de cada projeto podem trazer instrução escondida. O chat trata tudo isso como dado.
- O que o chat pode: ler (`Read`, `Glob`, `Grep`) dentro do projeto da conversa, do vault e das skills, menos os segredos da lista; usar skills do usuário; buscar na web e abrir os hosts da lista; ler o git do projeto; criar post; editar e anexar mídia só em post do projeto da conversa ou criado nela, com arquivo da pasta do projeto; mudar status só até pronto.
- O que o chat não pode: escrever ou apagar arquivo, rodar shell ou subagente, carregar hooks, env, skills ou CLAUDE.md do repositório, ler `.env` e afins (nem pelo `Grep` sem caminho), marcar post como postado, mexer em post de outro projeto, rodar git num repositório que configura programa externo.
- As skills editadas pela tela Skills não aceitam frontmatter novo nem a sequência exclamação mais crase, que no Claude Code do terminal rodaria um comando ao abrir a skill.
- O MCP stdio do terminal não tem essas travas de conversa: ele roda com a confiança do Claude Code de quem o registrou.

## Segurança

- Bind só em `127.0.0.1`. O guard (`guard.ts`) é uma função pura `allow(pedido, política)` chamada num `onRequest` global, que cobre a API, os arquivos do app e o upgrade do WebSocket, pela rota casada.
- Host precisa ser o local (`127.0.0.1:7338`, `localhost:7338`) ou o nome da tailnet com a porta do serve. Pela tailnet, o `Tailscale-User-Login` precisa ser o dono do nó (lido de `tailscale status --json` no boot e a cada minuto, porque o Tailscale pode subir depois ou trocar de perfil).
- Métodos que mudam algo exigem `Origin` igual ao Host (ausente ou `null` é recusado) e `Content-Type: application/json`; multipart só na rota de upload. Vale também para `DELETE /api/posts/:id`, que o app manda com corpo `{}`. Nenhum GET tem efeito colateral e não existe CORS.
- Respostas com CSP (`frame-ancestors 'none'`), `X-Frame-Options: DENY` e `nosniff`. Ícones de projeto saem com CSP `sandbox`.
- Upload detecta o tipo pelos bytes, gera o nome no servidor, recusa SVG e HTML e grava em streaming com limite de 100 MB.
- Ids de post e nomes de mídia passam por regex; o frontmatter é gerado e lido com a lib `yaml` e validado com zod.
- Push só para serviços de push conhecidos, em https.
- Skills: só o corpo dos `.md` é editável; o frontmatter (`allowed-tools`, `hooks` e afins) fica como estava, e corpo com exclamação seguida de crase é recusado. Nada de link simbólico nem caminho fora de `~/.claude/skills/<nome>/` e `~/.claude/agents/<nome>.md` dos nomes da config.
- WebSocket: o aparelho que chega pela tailnet é identificado pelo `X-Forwarded-For` do `tailscale serve` e `tailscale whois --json` (com cache de 10 min); o nome do nó aparece na pílula do topo.
- Limites de taxa em chat, upload, config, skills e push; intervalo de datas de no máximo 93 dias; logs sem URL, corpo ou chaves.
