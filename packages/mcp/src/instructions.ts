import { nets } from '@social-grid/core/network/index.ts'

const formats = nets.map((n) => `${n.name}: ${n.formats.map((f) => `${f.id} (${f.hint})`).join(', ')}`).join('. ')

export const instructions = `O social.grid é o painel em que o usuário planeja e prepara os posts dos projetos dele no Instagram e no LinkedIn. Pelas ferramentas daqui você lê a agenda e cria ou ajusta posts, que aparecem na hora no app (no PC e no celular).
- Vault: cada post é a pasta posts/<id>/ com post.md (frontmatter com rede, formato, status, data, hora, hashtags e mídia; a legenda é o corpo) e os arquivos de mídia ao lado. Nada aqui apaga post: excluir é só no app, pelo usuário, e o post vai para a lixeira do vault.
- Datas são YYYY-MM-DD e horas HH:MM, no horário local do PC (America/Sao_Paulo). listar_slots mostra os horários que a config pede e ainda estão vazios.
- Projetos: listar_projetos dá os repositórios git da pasta de projetos (id = nome da pasta). Post que não é de um projeto vai em "geral".
- Formatos. ${formats}.
- Ao terminar um post feito com as skills de postagem (instagram-post-writer, linkedin-post-writer ou o agente social-posts), salve com criar_post: a legenda vai sem as hashtags, e as hashtags vão sem #. Em tipo vai o tipo de post que a skill usou (ex.: bastidores técnico). No LinkedIn o link vai em comentario, nunca no corpo.
- criar_post e editar_post devolvem os avisos da rede. Erro impede o post de ficar pronto; aviso é só recomendação.
- Status: draft (rascunho) -> ready (pronto) -> posted (postado). Só fica pronto sem erro da rede. Marcar como postado é coisa do usuário, depois que ele publicar.
- Mídia: anexar_midia copia uma imagem ou um vídeo de dentro da pasta de projetos ou do vault para o post. Feed do Instagram com mais de uma mídia vira carrossel sozinho.
- Nunca use travessão nos textos dos posts.`
