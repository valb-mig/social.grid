import type { Wire } from '@social-grid/core/chat.ts'
import { useStore } from './store.ts'

export function connect(): () => void {
  let sock: WebSocket | null = null
  let wait = 1000
  let timer: ReturnType<typeof setTimeout> | undefined
  let beat: ReturnType<typeof setInterval> | undefined
  let closed = false
  let first = true

  const open = () => {
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
    sock = new WebSocket(url)
    sock.onopen = () => {
      wait = 1000
      useStore.setState({ live: true })
      const s = useStore.getState()
      if (!first) {
        void s.boot().catch(() => undefined)
        for (const id of Object.keys(s.chats)) void s.loadChat(id).catch(() => undefined)
      }
      first = false
      beat = setInterval(() => sock?.readyState === 1 && sock.send(JSON.stringify({ t: 'ping' })), 25_000)
    }
    sock.onmessage = (e) => {
      let m: Wire
      try {
        m = JSON.parse(String(e.data)) as Wire
      } catch {
        return
      }
      useStore.getState().wire(m)
    }
    sock.onclose = () => {
      clearInterval(beat)
      useStore.setState({ live: false, peers: [] })
      if (closed) return
      timer = setTimeout(open, wait)
      wait = Math.min(wait * 2, 15_000)
    }
  }

  const wake = () => {
    if (document.visibilityState === 'visible' && (!sock || sock.readyState > 1)) {
      clearTimeout(timer)
      open()
    }
  }

  open()
  document.addEventListener('visibilitychange', wake)
  return () => {
    closed = true
    clearTimeout(timer)
    clearInterval(beat)
    document.removeEventListener('visibilitychange', wake)
    sock?.close()
  }
}
