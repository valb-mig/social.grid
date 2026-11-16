import { fold, issue, known, length, many, pack, size, type Issue, type Net } from './net.ts'

const LINK = /(https?:\/\/|www\.)\S+/i

export const linkedin: Net = {
  id: 'linkedin',
  name: 'LinkedIn',
  formats: [
    { id: 'post', name: 'Post', hint: 'link no primeiro comentário', min: 0, max: 20 },
    { id: 'artigo', name: 'Artigo', hint: 'texto longo', min: 0, max: 1, shape: 'paisagem' },
  ],
  max: 3000,
  hook: 210,
  ideal: [4, 6],
  cap: 30,
  check(post) {
    const f = known(linkedin, post)
    if (!('min' in f)) return [f]
    const out: Issue[] = []
    if (!post.caption.trim()) out.push(issue('error', 'caption', 'Texto vazio'))
    else out.push(length(linkedin, post), fold(linkedin, post))
    out.push(many(linkedin, post))
    if (post.media.length) out.push(size(linkedin, post, f))
    if (LINK.test(post.caption)) out.push(issue('warn', 'link', 'Link no corpo derruba o alcance: ponha no primeiro comentário'))
    else if (post.comment.trim()) out.push(issue('ok', 'comment', 'Link vai no primeiro comentário'))
    return out
  },
  pack,
}
