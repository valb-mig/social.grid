import { useEffect, useRef } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import { Tabs, Toast, Top, useMobile } from './components/shell.tsx'
import { renew } from './lib/push.ts'
import { useStore } from './lib/store.ts'
import { connect } from './lib/ws.ts'
import { Agenda } from './screens/agenda.tsx'
import { Chat } from './screens/chat.tsx'
import { Settings } from './screens/config.tsx'
import { Hoje } from './screens/hoje.tsx'
import { PostScreen } from './screens/post.tsx'
import { Projetos } from './screens/projetos.tsx'

function Home() {
  return useMobile() ? <Hoje /> : <Agenda />
}

function Missing() {
  return <div className="p-8 text-text-muted">Página não encontrada.</div>
}

export function App() {
  const mobile = useMobile()
  const [loc, go] = useLocation()
  const first = useRef(true)

  useEffect(() => {
    const s = useStore.getState()
    void s.boot().catch(() => s.fail('o PC não respondeu'))
    const off = connect()
    void renew()
    const t = setInterval(() => void useStore.getState().loadProjects().catch(() => undefined), 5 * 60_000)
    const nav = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: string } | null
      if (d?.type === 'navigate' && typeof d.url === 'string' && d.url.startsWith('/')) go(d.url)
    }
    navigator.serviceWorker?.addEventListener('message', nav)
    return () => {
      off()
      clearInterval(t)
      navigator.serviceWorker?.removeEventListener('message', nav)
    }
  }, [go])

  useEffect(() => {
    if (first.current && mobile && loc === '/') go('/hoje', { replace: true })
    first.current = false
  }, [mobile, loc, go])

  return (
    <div className="flex h-dvh flex-col">
      <Top />
      <main className={`min-h-0 flex-1 ${mobile ? 'overflow-y-auto' : ''}`}>
        <Switch>
          <Route path="/" component={Agenda} />
          <Route path="/hoje" component={Home} />
          <Route path="/projetos" component={Projetos} />
          <Route path="/projetos/:id" component={Projetos} />
          <Route path="/post/:id" component={PostScreen} />
          <Route path="/chat" component={Chat} />
          <Route path="/chat/:id" component={Chat} />
          <Route path="/config" component={Settings} />
          <Route path="/config/:tab" component={Settings} />
          <Route component={Missing} />
        </Switch>
      </main>
      <Tabs />
      <Toast />
    </div>
  )
}
