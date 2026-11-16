# Celular

O servidor escuta só em `127.0.0.1`. O celular chega pelo `tailscale serve`, que publica a porta com https dentro da sua tailnet.

## Publicar na tailnet

O app publica sozinho. Ao subir (e a cada minuto, se o Tailscale ainda não estava de pé), ele roda `tailscale serve --bg --https=8443 7338`, desde que:

- o Tailscale esteja rodando no PC;
- o MagicDNS e os certificados HTTPS estejam ligados no painel de DNS da tailnet;
- o usuário do PC seja operator do Tailscale. Se não for, o Tailscale pede sudo, e Config, Celular mostra o comando para rodar uma vez: `sudo tailscale set --operator=$USER`;
- a porta 8443 da tailnet esteja livre ou já leve ao app. Se ela levar a outro serviço, o app não sobrescreve: mostra o que está lá e espera você liberar a porta ou trocar `SOCIAL_GRID_SERVE_PORT`.

Config, Celular mostra o estado, o link com botão de copiar, o QR para a câmera do celular, os celulares da sua conta na tailnet (online ou offline) e, quando falta algo, o passo com o comando ou o link exato. No PC, a pílula do topo abre o mesmo QR.

O endereço fica `https://<nome-do-pc>.<sua-tailnet>.ts.net:8443`. O servidor aceita esse nome sozinho (lido de `tailscale status --json`) e só atende o dono do nó: o pedido precisa chegar com o `Tailscale-User-Login` da sua conta. Para liberar outra conta, use `SOCIAL_GRID_LOGINS=conta@github,outra@github`. Com o celular conectado, a pílula do topo no PC mostra o nome dele na tailnet.

Para desligar, use o botão "Publicar na tailnet" em Config, Celular. Ele tira só a porta do app do serve (`tailscale serve --https=8443 off`) e grava a escolha na config, para o app não publicar de novo ao subir. Só o PC liga ou desliga: pela tailnet o botão aparece travado e a API responde 403.

Plano B, na mão: `tailscale serve --bg --https=8443 7338`.

Se você tem mais de um perfil no Tailscale, o serve e o nome valem para o perfil ativo. O servidor relê o nome a cada minuto e na hora em que publica.

## Instalar o app

1. Com o Tailscale ligado no celular, aponte a câmera para o QR de Config, Celular (ou abra `https://<nome-do-pc>.<sua-tailnet>.ts.net:8443/hoje` no Chrome).
2. Menu, "Instalar app" (ou "Adicionar à tela inicial").
3. Abra o app instalado. A aba Hoje mostra o próximo post.

## Avisos

1. No app, toque em "Ativar avisos neste celular" (ou Config, Celular, "Inscrever este aparelho") e aceite a permissão.
2. "Mandar aviso de teste" confere o caminho todo.

O servidor manda dois avisos, configuráveis em Config, Frequência ou Celular:

- post pronto: N minutos antes da hora (padrão 15), mesmo que a janela comece no dia anterior. Se o PC estava dormindo e acordou dentro da janela, o aviso ainda sai;
- rascunho: no horário escolhido (padrão 09:00) ou N minutos antes do post, o que vier primeiro, se ele ainda é rascunho. Depois da hora do post não avisa mais.

Cada aviso sai uma vez só. Tocar no aviso abre o post.

## Postar

Na aba Hoje, o post da vez vem como pacote (um post de hoje que passou da hora sem ser postado continua ali, marcado como atrasado):

- Compartilhar: copia legenda e hashtags e abre a folha de compartilhar do Android com as mídias na ordem. Escolha o Instagram (ou o LinkedIn) e cole a legenda. Enquanto a mídia baixa do PC o botão fica em "Preparando mídia"; se ela não baixar, aparece "Tentar de novo".
- Legenda e Hashtags copiam cada parte.
- Marcar postado fecha o post.

Aberto no celular, um post pronto vira passo a passo: mídia, legenda, hashtags (e o comentário com o link no LinkedIn) e "Postei". Se a tela bloquear no meio de uma conversa do chat, o app busca o que perdeu quando volta.
