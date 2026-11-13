<p align="center"><img src="apps/web/public/logo.svg" width="88" alt="social.grid"></p>

# social.grid

Painel pessoal para organizar e preparar os posts dos seus projetos no Instagram e no LinkedIn. Roda no PC, lê os repositórios git de `~/Projects`, mostra a agenda com os horários que você definiu e tem o Claude Code embutido para escrever os posts com as suas skills. No celular abre pela tailnet como app (PWA), avisa antes da hora e entrega mídia, legenda e hashtags prontas para colar. Sem nuvem e sem login.

## Rodar

```sh
pnpm install
pnpm build
pnpm start
```

Abra `http://127.0.0.1:7338`. Para desenvolver, `pnpm dev`. Para instalar como serviço do usuário, `deploy/install.sh`.

## Docs

- [Arquitetura](docs/arquitetura.md)
- [Vault](docs/vault.md)
- [MCP](docs/mcp.md)
- [Celular](docs/celular.md)
- [Desenvolvimento e testes](docs/desenvolvimento.md)

## Licença

[MIT](LICENSE)
