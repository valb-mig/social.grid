# MCP

As ferramentas do social.grid existem em dois lugares, com o mesmo código (`packages/mcp/src/tools.ts`):

- no chat do app, embutidas no Agent SDK, usando o mesmo repositório e o mesmo bus do servidor;
- num servidor stdio para o Claude Code do terminal.

## Terminal

Para usar no Claude Code fora do app, registre o servidor stdio uma vez (troque o caminho pela pasta do projeto):

```sh
claude mcp add -s user social-grid -- node /home/valb/Projects/social.grid/packages/mcp/src/stdio.ts
```

Ele lê o vault de `SOCIAL_GRID_VAULT` ou `~/SocialGrid`. O que ele grava aparece no app ao vivo pelo watcher do servidor. Para testar à mão: `pnpm mcp`.

## Ferramentas

| nome | o que faz |
| --- | --- |
| `listar_projetos` | repositórios da pasta de projetos e `geral`, com atividade no git e contagem de posts por status |
| `ler_config` | redes, frequência, hashtags padrão, skills e avisos |
| `listar_posts` | `{de, ate, projeto?, status?, sem_data?}`, até 93 dias |
| `ler_post` | `{id}`: o post e os avisos da rede |
| `listar_slots` | `{de, ate}`: só os horários da config ainda vazios |
| `criar_post` | `{projeto, rede, formato, tipo?, titulo, legenda, hashtags, data?, hora?, comentario?}`: cria em rascunho, com as hashtags padrão, e devolve os avisos da rede |
| `editar_post` | `{id, atualizado_em?, ...campos, ordem_midia?, status?}`: muda só o que vier; `atualizado_em` evita sobrescrever uma edição feita no app |
| `anexar_midia` | `{id, caminho}`: copia uma imagem ou um vídeo de dentro da pasta de projetos ou do vault, até 100 MB, conferindo o tipo pelos bytes; feed do Instagram que passa de 1 mídia vira carrossel |
| `gerar_imagem` | `{id, html, tamanho?}`: transforma o HTML do agente (capa, card, slide) num PNG e anexa ao post. O tamanho sai do formato (story 1080x1920, artigo do LinkedIn 1920x1080, o resto 1080x1350) ou de `tamanho` (`retrato`, `quadrado`, `vertical`, `paisagem`); reels recusa, porque pede vídeo |

Não existe ferramenta de excluir post, nem no chat nem no terminal: excluir é só no app, pelo usuário, e o post vai para a lixeira do vault. O teste `o MCP não expõe exclusão` trava a lista de ferramentas.

No chat existe também `git` (`{sub, args}`), que lê `log`, `show`, `diff` e `status` do projeto da conversa sem shell, e recusa repositório cujo `.git/config` chama programa externo.

O `gerar_imagem` usa o Google Chrome ou o Chromium do PC (ou o de `SOCIAL_GRID_CHROME`) em modo headless, com perfil temporário, e embute a Manrope e a JetBrains Mono do app. A página roda fechada: a CSP no topo bloqueia script e qualquer recurso que não seja `data:`, as `<meta>` do HTML saem (nada de `refresh` para um arquivo do PC), a rede passa por um proxy morto e só um render roda por vez.

No chat do app as ferramentas recebem o contexto da conversa: `editar_post`, `anexar_midia` e `gerar_imagem` só valem para posts do projeto da conversa ou criados nela, `anexar_midia` só aceita arquivo da pasta desse projeto e o status vai só até `ready` (marcar como postado é do usuário). O servidor stdio do terminal não tem essas travas.

As instruções do servidor (`packages/mcp/src/instructions.ts`) explicam o vault, as datas locais e pedem para salvar com `criar_post` o post feito com as skills `instagram-post-writer`, `linkedin-post-writer` ou o agente `social-posts`.
