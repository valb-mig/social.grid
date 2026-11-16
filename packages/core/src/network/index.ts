import { fail } from '../fault.ts'
import { instagram } from './instagram.ts'
import { linkedin } from './linkedin.ts'
import { tiktok } from './tiktok.ts'
import { youtube } from './youtube.ts'
import type { Format, Net, Shape } from './net.ts'

export const nets: readonly Net[] = [instagram, linkedin, tiktok, youtube]

export const ids = nets.map((n) => n.id) as [string, ...string[]]

export const find = (id: string): Net | undefined => nets.find((n) => n.id === id)

export const get = (id: string): Net => find(id) ?? fail('invalid', `rede desconhecida: ${id}`)

export function format(net: string, id: string): Format {
  return get(net).formats.find((f) => f.id === id) ?? fail('invalid', `formato ${id} não existe no ${get(net).name}`)
}

export const slot = (net: string, id: string): string => {
  const f = find(net)?.formats.find((x) => x.id === id)
  return f?.under ?? id
}

export const shape = (net: string, id: string): Shape => find(net)?.formats.find((x) => x.id === id)?.shape ?? 'retrato'

export const rules = (net: string): Format[] => find(net)?.formats.filter((f) => !f.under) ?? []

export function grow(net: string, id: string, n: number): string {
  const f = find(net)?.formats.find((x) => x.id === id)
  return f?.more && n > f.max ? f.more : id
}
