import { join, resolve } from 'node:path'
import { home, where } from '@social-grid/vault/open.ts'

const env = process.env

export const PORT = Number(env.SOCIAL_GRID_PORT || 7338)
export const HOST = '127.0.0.1'
export const VAULT = where()
export const HOME = home()
export const STATE = env.SOCIAL_GRID_STATE || join(HOME, '.local', 'state', 'social-grid')
export const DEV = env.SOCIAL_GRID_DEV === '1'
export const SERVE = Number(env.SOCIAL_GRID_SERVE_PORT ?? 8443)
export const TAILSCALE = env.SOCIAL_GRID_TAILSCALE || 'tailscale'
export const LOGINS = (env.SOCIAL_GRID_LOGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
export const WEB = resolve(import.meta.dirname, '..', '..', 'web', 'dist')
