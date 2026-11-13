const seen: string[] = []

export function mark(loc: string) {
  if (seen.at(-1) === loc) return
  seen.push(loc)
  if (seen.length > 30) seen.shift()
}

export const back = (skip: (loc: string) => boolean, fallback = '/') => [...seen].reverse().find((l) => !skip(l)) ?? fallback
