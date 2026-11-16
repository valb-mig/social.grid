<p align="center"><img src="apps/web/public/logo.svg" width="88" alt="social.grid"></p>

# social.grid

Painel pessoal para organizar e preparar os posts dos seus projetos no Instagram, no LinkedIn, no TikTok e no YouTube. Roda no PC, lê os repositórios git de `~/Projects`, mostra a agenda com os horários que você definiu e tem o Claude Code embutido para escrever os posts com as suas skills. No celular abre pela tailnet como app (PWA), avisa antes da hora e entrega mídia, legenda e hashtags prontas para colar. Sem nuvem e sem login.

## Instalar

```sh
curl -fsSL https://github.com/valb-mig/social.grid/releases/latest/download/install.sh | bash
```

Precisa do Node 26 e do systemd. Baixa a última release para `~/.local/opt/social-grid`, sobe o serviço de usuário em `http://127.0.0.1:7338` e põe o social.grid no menu de apps, com o ícone no tema e a janela própria. Rodar de novo atualiza. Para uma versão específica, `SOCIAL_GRID_VERSION=0.1.0` antes do `bash`.

## Rodar do código

```sh
pnpm install
pnpm build
pnpm start
```

Abra `http://127.0.0.1:7338`. Para desenvolver, `pnpm dev`. Para instalar este clone como serviço do usuário, com o atalho no menu, `deploy/install.sh`.

## Docs

- [Arquitetura](docs/arquitetura.md)
- [Vault](docs/vault.md)
- [MCP](docs/mcp.md)
- [Celular](docs/celular.md)
- [Desenvolvimento e testes](docs/desenvolvimento.md)

## Licença

[MIT](LICENSE)
