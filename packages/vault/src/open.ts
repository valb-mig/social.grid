import { homedir } from 'node:os'
import { join } from 'node:path'
import { config } from './config.ts'
import { posts } from './posts.ts'
import { source } from './projects/source.ts'

export const home = () => process.env.HOME || homedir()

export const where = () => process.env.SOCIAL_GRID_VAULT || join(home(), 'SocialGrid')

export function open(dir = where(), h = home()) {
  const repo = posts(dir)
  const cfg = config(dir, h)
  const projects = source({ root: cfg.projects, vault: dir })
  return { dir, home: h, repo, cfg, projects }
}

export type Vault = ReturnType<typeof open>
