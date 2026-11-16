import { kind } from '../media.ts'
import type { Post } from '../post/post.ts'
import { fold, heading, issue, known, length, many, pack, size, type Issue, type Net } from './net.ts'

const TITLE = 100

function cover(post: Post): Issue {
  const videos = post.media.filter((m) => kind(m) === 'video').length
  const n = post.media.length
  if (!videos) return issue('error', 'media_video', 'Vídeo precisa de um arquivo de vídeo')
  if (videos > 1 || n > 2) return issue('error', 'media_max', 'Vídeo leva 1 vídeo e, se quiser, 1 imagem de capa')
  return issue('ok', 'media', n === 2 ? 'Vídeo com capa' : 'Vídeo sem capa: o YouTube escolhe um quadro')
}

export const youtube: Net = {
  id: 'youtube',
  name: 'YouTube',
  formats: [
    { id: 'shorts', name: 'Shorts', hint: 'vídeo vertical até 3 min', min: 1, max: 1, video: true, shape: 'vertical' },
    { id: 'video', name: 'Vídeo', hint: 'vídeo e capa opcional; o título do post é o do vídeo', min: 1, max: 2, shape: 'paisagem' },
    { id: 'comunidade', name: 'Comunidade', hint: 'texto com até 10 imagens', min: 0, max: 10, image: true, shape: 'quadrado' },
  ],
  max: 5000,
  hook: 150,
  ideal: [3, 5],
  cap: 15,
  check(post) {
    const f = known(youtube, post)
    if (!('min' in f)) return [f]
    const out: Issue[] = []
    if (f.id === 'video') out.push(cover(post))
    else if (f.id === 'shorts' || post.media.length) out.push(size(youtube, post, f))
    if (f.id !== 'comunidade') out.push(heading(post, TITLE))
    if (!post.caption.trim()) out.push(f.id === 'comunidade' ? issue('error', 'caption', 'Texto vazio') : issue('warn', 'caption', 'Sem descrição: a busca do YouTube lê o texto'))
    else out.push(length(youtube, post), fold(youtube, post))
    out.push(many(youtube, post))
    return out
  },
  pack,
}
