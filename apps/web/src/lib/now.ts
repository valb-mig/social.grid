import { useEffect, useState } from 'react'

export function useNow(every = 30_000) {
  const [now, set] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => set(new Date()), every)
    return () => clearInterval(t)
  }, [every])
  return now
}
