export type Kind = 'image' | 'video'

const TYPES: Record<string, { kind: Kind; mime: string }> = {
  jpg: { kind: 'image', mime: 'image/jpeg' },
  png: { kind: 'image', mime: 'image/png' },
  webp: { kind: 'image', mime: 'image/webp' },
  gif: { kind: 'image', mime: 'image/gif' },
  mp4: { kind: 'video', mime: 'video/mp4' },
  mov: { kind: 'video', mime: 'video/quicktime' },
  webm: { kind: 'video', mime: 'video/webm' },
}

export const MAX_BYTES = 100 * 1024 * 1024

const ext = (name: string) => name.slice(name.lastIndexOf('.') + 1).toLowerCase()

export const kind = (name: string): Kind | null => TYPES[ext(name)]?.kind ?? null
export const mime = (name: string): string => TYPES[ext(name)]?.mime ?? 'application/octet-stream'

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to))
const starts = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v)

export function sniff(b: Uint8Array): string | null {
  if (starts(b, [0xff, 0xd8, 0xff])) return 'jpg'
  if (starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (ascii(b, 0, 4) === 'GIF8') return 'gif'
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp'
  if (starts(b, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm'
  if (ascii(b, 4, 8) === 'ftyp') {
    const brand = ascii(b, 8, 12)
    if (brand === 'qt  ') return 'mov'
    if (/^(isom|iso[2-9]|mp4[12]|avc1|M4V |mmp4|dash|f4v )$/.test(brand)) return 'mp4'
  }
  return null
}
