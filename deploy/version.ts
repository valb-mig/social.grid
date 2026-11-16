import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

type V = [number, number, number]

const file = new URL('../package.json', import.meta.url)
const pkg = JSON.parse(readFileSync(file, 'utf8'))
const parse = (v: string): V | null => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}
const cmp = (a: V, b: V) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' })
  .split('\n')
  .map(parse)
  .filter((v) => v !== null)
  .sort(cmp)
const last = tags.at(-1)
const floor = parse(String(pkg.version ?? ''))
if (!floor) throw new Error(`versão inválida no package.json: ${pkg.version}`)

const next: V = !last || cmp(floor, last) > 0 ? floor : [last[0], last[1], last[2] + 1]
pkg.version = next.join('.')
writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
console.log(`version=${pkg.version}`)
