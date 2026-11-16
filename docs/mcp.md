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
| `gerar_imagem` | `{id, html, tamanho?}`: transforma o HTML do agente (capa, card, slide) num PNG e anexa ao post. O tamanho sai do formato (story 1080x1920, artigo do LinkedIn 1920x1080, o resto 1080x1350) ou de `tamanho` (`retrato`, `quadrado`, `vertical`, `paisagem`); reels recusa, porque pede vídeo. Aceita a tag `<sg-mockup>`, que põe um celular, um laptop ou uma janela de navegador na arte (abaixo) |
| `capturar_tela` | `{id, url, tamanho?, escala?}`: tira o print de uma página deste PC (`localhost` ou `127.0.0.1`, em qualquer porta, ou um caminho do próprio social.grid como `/hoje`) e anexa ao post. A página roda normal, com script, e o print sai depois que ela carrega os dados. `escala` (1 a 3) abre a página com a largura dividida e a imagem nítida: na 2, o `/hoje` sai no layout de celular |

Não existe ferramenta de excluir post, nem no chat nem no terminal: excluir é só no app, pelo usuário, e o post vai para a lixeira do vault. O teste `o MCP não expõe exclusão` trava a lista de ferramentas.

No chat existe também `git` (`{sub, args}`), que lê `log`, `show`, `diff` e `status` do projeto da conversa sem shell, e recusa repositório cujo `.git/config` chama programa externo.

O `gerar_imagem` usa o Google Chrome ou o Chromium do PC (ou o de `SOCIAL_GRID_CHROME`) em modo headless, com perfil temporário, e embute a Manrope e a JetBrains Mono do app. A página roda fechada: a CSP no topo bloqueia script e qualquer recurso que não seja `data:`, as `<meta>` do HTML saem (nada de `refresh` para um arquivo do PC), a rede passa por um proxy morto e só um render roda por vez.

O `capturar_tela` usa o mesmo Chrome, com perfil temporário, mas a página roda aberta (é o app do usuário) e é controlada pelo DevTools num pipe (`--remote-debugging-pipe`): a largura da página é emulada desde o carregamento, então o script dela já lê a largura certa mesmo abaixo dos 500 px que a janela do Chrome headless aceita, e o print sai depois de 8 s de tempo virtual, com os timers e a rede da página resolvidos. Com o app parado, a ferramenta responde que a página não abriu, em vez de anexar a tela de erro do Chrome. O endereço inicial precisa ser deste PC: outro host, IP da rede, `file:`, `data:`, `javascript:` e URL com usuário e senha são recusados antes de abrir o Chrome. O print mostra dados reais, e o chat pede para o usuário conferir antes de publicar.

## Mockups

Dentro do HTML do `gerar_imagem`, a tag `<sg-mockup>` vira um aparelho sem fundo, com o conteúdo já encaixado na tela:

```html
<sg-mockup modelo="celular" cor="roxo" largura="380" print="http://localhost:5173/"
  style="position:absolute;left:640px;top:480px;transform:rotate(4deg);filter:drop-shadow(0 30px 40px rgba(0,0,0,.5))">
</sg-mockup>
```

| modelo | tela | cores | largura padrão |
| --- | --- | --- | --- |
| `celular` | 393x852 (iPhone 14/15 Pro), cantos arredondados e ilha | `preto`, `prata`, `roxo` | 400 |
| `laptop` | 1440x900 (16:10) | `preto`, `prata` | 900 |
| `navegador` | 1440x900, janela no estilo do Safari, com a página até a borda e os cantos de baixo arredondados | `claro`, `escuro` | 900 |

- `largura` é em px; a altura sai dela. Posição, rotação e sombra vão no `style` (sem `width` nem `height`).
- A tela recebe HTML filho, desenhado no tamanho da tela do aparelho e reduzido para caber; `midia="m-xxx.png"`, uma imagem do próprio post; ou `print="url"`, uma página deste PC com as mesmas regras do `capturar_tela`, aberta já no tamanho da tela do aparelho (o celular pega o layout de celular do app) e com nitidez de acordo com o tamanho que a tela tem na arte. HTML filho junto com `midia` ou `print` fica por cima da imagem.
- No `navegador`, `endereco="mocha.app"` (uma linha, até 80 caracteres) escreve o endereço na pílula da barra, com o cadeado, na Manrope e com reticências se não couber. Sem ele a pílula fica vazia: o `localhost` do `print` nunca aparece. Os outros modelos recusam `endereco`.
- Até 6 aparelhos por imagem, 2 com `print`. Modelo, cor, atributo ou mídia inválidos e endereço de fora do PC são recusados antes de abrir o Chrome.
- Os desenhos são SVG feitos em código (`packages/mcp/src/mockup.ts`), sem arte de terceiros. A tela de cada modelo é um recorte na máscara do SVG: o conteúdo fica por baixo da moldura, num retângulo com o mesmo tamanho do recorte, e a ilha do celular fica por cima. O navegador não tem moldura em volta da página: a página vai até a borda da janela e o contorno fino do SVG passa por cima dela. Texto que vem do agente (o endereço) não entra no SVG, que dentro de `<img>` não enxerga as fontes da arte: vai numa camada de HTML por cima da moldura. Modelo novo é um objeto novo em `MODELS`, com o tamanho do desenho, o retângulo da tela (raio único ou um por canto), a sangria do fundo preto atrás da tela (0 quando a tela encosta na borda), os atributos extras que aceita, as cores, o SVG e, se precisar, a camada de HTML por cima.

No chat do app as ferramentas recebem o contexto da conversa: `editar_post`, `anexar_midia`, `gerar_imagem` e `capturar_tela` só valem para posts do projeto da conversa ou criados nela, `anexar_midia` só aceita arquivo da pasta desse projeto e o status vai só até `ready` (marcar como postado é do usuário). O servidor stdio do terminal não tem essas travas.

As instruções do servidor (`packages/mcp/src/instructions.ts`) explicam o vault, as datas locais e pedem para salvar com `criar_post` o post feito com as skills `instagram-post-writer`, `linkedin-post-writer` ou o agente `social-posts`.
