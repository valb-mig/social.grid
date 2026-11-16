import { fold, issue, known, length, many, pack, size, type Issue, type Net } from './net.ts'

const LINK = /(https?:\/\/|www\.)\S+/i

export const tiktok: Net = {
  id: 'tiktok',
  name: 'TikTok',
  formats: [
    { id: 'video', name: 'Vídeo', hint: 'vídeo vertical', min: 1, max: 1, video: true, shape: 'vertical' },
    { id: 'fotos', name: 'Fotos', hint: 'só imagem, até 20 fotos', min: 1, max: 20, image: true, shape: 'vertical' },
  ],
  max: 4000,
  hook: 100,
  ideal: [3, 5],
  cap: Infinity,
  check(post) {
    const f = known(tiktok, post)
    if (!('min' in f)) return [f]
    const out: Issue[] = [size(tiktok, post, f)]
    if (!post.caption.trim()) out.push(issue('warn', 'caption', 'Sem legenda: a busca do TikTok lê o texto'))
    else out.push(length(tiktok, post), fold(tiktok, post))
    out.push(many(tiktok, post))
    if (LINK.test(post.caption)) out.push(issue('warn', 'link', 'Link na legenda do TikTok não abre: ponha na bio'))
    return out
  },
  pack,
}
