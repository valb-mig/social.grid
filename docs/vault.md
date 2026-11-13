# Vault

Tudo o que é seu fica em arquivos comuns, em `~/SocialGrid` (ou na pasta de `SOCIAL_GRID_VAULT`):

```
~/SocialGrid/
  config.json
  posts/
    carrossel-do-mocha-179m/
      post.md
      m-25984c648e.jpg
      m-fab473c5ff.jpg
```

## Post

Cada post é uma pasta com `post.md` e a mídia ao lado. O id é o slug do título mais 4 caracteres aleatórios e não muda depois.

```md
---
id: carrossel-do-mocha-179m
project: mocha.app
network: instagram
format: carrossel
type: bastidores
status: ready
date: 2026-11-13
time: 12:00
title: Carrossel do mocha
hashtags:
  - buildinpublic
  - devbrasil
media:
  - m-25984c648e.jpg
  - m-fab473c5ff.jpg
comment: ""
postedAt: null
createdAt: 2026-11-10T15:00:00.000Z
updatedAt: 2026-11-12T15:00:00.000Z
---

Seu design ainda mora em print solto no WhatsApp?
```

- O corpo é a legenda, sem as hashtags (elas entram no pacote na hora de postar).
- `project` é o nome da pasta do repositório em `~/Projects`, ou `geral`.
- `network`: `instagram` ou `linkedin`. `format`: `feed`, `carrossel`, `story`, `reels` (Instagram) ou `post`, `artigo` (LinkedIn). Feed com 2 mídias ou mais vira carrossel sozinho.
- `type` (opcional): o tipo de post da skill (`bastidores técnico`, `projeto grande`, `post único`), mostrado nas listas no lugar do formato.
- `status`: `draft`, `ready` ou `posted`. `date` e `time` podem ser `null` (post sem data).
- `media` é a ordem das mídias. Tirar um nome da lista não apaga o arquivo.
- `archived: true` esconde o post da agenda sem apagar nada.

Dá para editar `post.md` à mão: o app percebe a mudança e atualiza na hora, inclusive no editor aberto (se você não estiver digitando nele). Campos ausentes ou inválidos voltam ao padrão: sem `network` vira Instagram, formato desconhecido vira o primeiro da rede, sem `status` vira rascunho, sem `title` usa o id, e assim por diante. Um `post.md` com só `title` já entra no app. Nomes de mídia fora do padrão `m-xxxx.ext` são ignorados.

## config.json

Escrito pela tela Config. Também dá para editar à mão; o servidor relê quando o arquivo muda.

- `root`: pasta de projetos (`null` usa `~/Projects`). Precisa existir e não pode ser `/`, a home ou uma pasta acima dela.
- `model`: modelo do chat (`null` usa o padrão do Claude Code).
- `nets`: rede ligada ou não e o perfil (`@valb.dev`, `in/valb-mig`).
- `rules`: frequência. Cada regra tem rede, formato, dias (`0` é segunda, `6` é domingo), horários `HH:MM` e liga/desliga.
- `tags.nets` e `tags.projects`: hashtags padrão que entram no post novo.
- `skills` e `agents`: nomes listados e editáveis na tela Skills.
- `push`: aviso antes do post pronto (`ready`, `before` em minutos) e aviso de rascunho do dia (`draft`, `at`).

## Estado do servidor

Fora do vault, em `~/.local/state/social-grid` (ou `SOCIAL_GRID_STATE`), com pasta `0700` e arquivos `0600`:

- `push.json`: chaves VAPID e inscrições dos aparelhos.
- `sent.json`: avisos já enviados (limpos depois de 3 dias).
- `chat.json`: conversas do chat (id, sessão do Claude Code, projeto, título).
- `pics/`: imagens anexadas no chat.
