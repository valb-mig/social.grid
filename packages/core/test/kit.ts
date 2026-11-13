import { make, type Input, type Post } from '../src/post/post.ts'

export const at = (iso: string) => new Date(iso)

export function post(i: Partial<Input> & Partial<Post> = {}, now = at('2026-11-13T10:00:00')): Post {
  const base = make({ network: 'instagram', format: 'feed', title: 'Post de teste', caption: 'Gancho curto.\n\nCorpo do post.', ...i }, now)
  return { ...base, id: i.id ?? 'post-de-teste-abcd', ...i, hashtags: i.hashtags ?? base.hashtags, media: i.media ?? base.media } as Post
}

export const many = (n: number, prefix = 'tag') => Array.from({ length: n }, (_, k) => `${prefix}${k + 1}`)
