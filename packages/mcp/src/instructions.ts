import { nets } from '@social-grid/core/network/index.ts'

const formats = nets.map((n) => `${n.name}: ${n.formats.map((f) => `${f.id} (${f.hint})`).join(', ')}`).join('. ')
const names = nets.map((n) => `no ${n.name}`)
const where = `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`

export const instructions = `O social.grid é o painel em que o usuário planeja e prepara os posts dos projetos dele ${where}. Pelas ferramentas daqui você lê a agenda e cria ou ajusta posts, que aparecem na hora no app (no PC e no celular).
- Vault: cada post é a pasta posts/<id>/ com post.md (frontmatter com rede, formato, status, data, hora, hashtags e mídia; a legenda é o corpo) e os arquivos de mídia ao lado. Nada aqui apaga post: excluir é só no app, pelo usuário, e o post vai para a lixeira do vault.
- Datas são YYYY-MM-DD e horas HH:MM, no horário local do PC (America/Sao_Paulo). listar_slots mostra os horários que a config pede e ainda estão vazios.
- Projetos: listar_projetos dá os repositórios git da pasta de projetos (id = nome da pasta). Post que não é de um projeto vai em "geral".
- Formatos. ${formats}.
- Ao terminar um post feito com as skills de postagem (instagram-post-writer, linkedin-post-writer ou o agente social-posts), salve com criar_post: a legenda vai sem as hashtags, e as hashtags vão sem #. Em tipo vai o tipo de post que a skill usou (ex.: bastidores técnico). No LinkedIn o link vai em comentario, nunca no corpo.
- TikTok e YouTube ainda não têm skill de postagem: escreva você mesmo, no tom das outras. No TikTok link na legenda não abre, então ele vai na bio. No Shorts e no vídeo do YouTube o titulo do post é o título do vídeo (até 100 letras) e a legenda é a descrição; com mais de 15 hashtags o YouTube ignora todas.
- criar_post e editar_post devolvem os avisos da rede. Erro impede o post de ficar pronto; aviso é só recomendação.
- Status: draft (rascunho) -> ready (pronto) -> posted (postado). Só fica pronto sem erro da rede. Marcar como postado é coisa do usuário, depois que ele publicar.
- Mídia: anexar_midia copia uma imagem ou um vídeo de dentro da pasta de projetos ou do vault para o post. Para criar a arte (capa, card, slide), escreva o HTML e chame gerar_imagem: ele vira PNG no tamanho do formato e entra no post. Para mostrar um app rodando no PC (o do projeto em localhost ou o próprio social.grid), use capturar_tela. Para pôr o app num celular, num laptop ou numa janela de navegador, use a tag sg-mockup no HTML do gerar_imagem: com print o servidor tira o print já no tamanho da tela do aparelho e encaixa nela. Nunca peça ao usuário para salvar arquivo, converter HTML ou rodar comando para ter a imagem. Feed do Instagram com mais de uma mídia vira carrossel sozinho. No vídeo do YouTube a imagem é a capa, em paisagem.
- Nunca use travessão nos textos dos posts.`
