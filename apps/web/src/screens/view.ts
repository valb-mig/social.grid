import { today } from '@social-grid/core/day.ts'
import { create } from 'zustand'

export type Mode = 'mes' | 'semana'

type View = { mode: Mode; anchor: string; set(v: Partial<{ mode: Mode; anchor: string }>): void }

const saved = (): Mode => {
  try {
    return localStorage.getItem('sg:modo') === 'semana' ? 'semana' : 'mes'
  } catch {
    return 'mes'
  }
}

export const useView = create<View>((set) => ({
  mode: saved(),
  anchor: today(new Date()),
  set(v) {
    if (v.mode) {
      try {
        localStorage.setItem('sg:modo', v.mode)
      } catch {}
    }
    set(v)
  },
}))
