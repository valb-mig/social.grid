import type { Fresh, Post } from './post.ts'

export type Repo = {
  list(): Promise<Post[]>
  get(id: string): Promise<Post | null>
  create(post: Fresh): Promise<Post>
  update(id: string, fn: (post: Post) => Post, base?: string): Promise<Post>
  attach(id: string, src: string, ext: string, move?: boolean): Promise<string>
  drop(id: string, name: string): Promise<void>
  temp(id: string): Promise<string>
  file(id: string, name: string): Promise<string | null>
}
