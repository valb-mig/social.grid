export type Tick = (now: Date) => Promise<unknown>

export function clock(ticks: Tick[], now: () => Date = () => new Date()): () => void {
  let timer: NodeJS.Timeout | undefined
  let stopped = false
  const next = () => {
    if (stopped) return
    const t = now()
    timer = setTimeout(run, 60_000 - (t.getSeconds() * 1000 + t.getMilliseconds()) + 500)
    timer.unref()
  }
  const run = async () => {
    const t = now()
    await Promise.allSettled(ticks.map((f) => f(t)))
    next()
  }
  next()
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}
