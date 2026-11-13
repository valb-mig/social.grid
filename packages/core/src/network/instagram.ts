import { fold, issue, known, length, many, pack, size, type Issue, type Net } from './net.ts'

export const instagram: Net = {
  id: 'instagram',
  name: 'Instagram',
  formats: [
    { id: 'feed', name: 'Feed', hint: 'post único; 2+ mídias vira carrossel', min: 1, max: 1, more: 'carrossel' },
    { id: 'carrossel', name: 'Carrossel', hint: '2 a 10 mídias', min: 2, max: 10, under: 'feed' },
    { id: 'story', name: 'Story', hint: '1 mídia vertical', min: 1, max: 1 },
    { id: 'reels', name: 'Reels', hint: 'vídeo até 90 s', min: 1, max: 1, video: true },
  ],
  max: 2200,
  hook: 125,
  ideal: [8, 15],
  cap: 30,
  check(post) {
    const f = known(instagram, post)
    if (!('min' in f)) return [f]
    const out: Issue[] = [size(instagram, post, f)]
    if (f.id === 'story') return out
    if (!post.caption.trim()) out.push(issue('error', 'caption', 'Legenda vazia'))
    else out.push(length(instagram, post), fold(instagram, post))
    out.push(many(instagram, post))
    return out
  },
  pack,
}
