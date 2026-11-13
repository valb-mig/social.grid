import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fail } from '@social-grid/core/fault.ts'
import { mime, sniff } from '@social-grid/core/media.ts'
import { write } from '@social-grid/vault/atomic.ts'
import { picture } from './events.ts'
import type { Pic } from './session.ts'

export const NAME = /^[0-9a-f]{24}\.(jpg|png|webp|gif)$/
export const MAX_PIC = 5 * 1024 * 1024
export const MAX_PICS = 4

export function pics(dir: string) {
  const path = (name: string) => {
    if (!NAME.test(name)) fail('invalid', 'imagem inválida')
    return join(dir, name)
  }
  return {
    async save(data: Buffer): Promise<string> {
      if (data.length > MAX_PIC) fail('too_large', 'imagem maior que 5 MB')
      const ext = sniff(data)
      if (!ext || !['jpg', 'png', 'webp', 'gif'].includes(ext)) fail('invalid', 'só imagem jpg, png, webp ou gif')
      const name = picture(data, mime(`x.${ext}`)) ?? fail('invalid', 'imagem inválida')
      if (!(await stat(path(name)).catch(() => null))) await write(path(name), data, 0o600)
      return name
    },
    async load(name: string): Promise<Pic> {
      const data = await readFile(path(name)).catch(() => fail('not_found', 'imagem não encontrada; anexe de novo'))
      return { name, type: mime(name), data }
    },
    async file(name: string): Promise<string | null> {
      if (!NAME.test(name)) return null
      return (await stat(join(dir, name)).catch(() => null))?.isFile() ? join(dir, name) : null
    },
  }
}

export type Pics = ReturnType<typeof pics>
