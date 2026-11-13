import { LoaderCircle } from 'lucide-react'
import { AlertDialog } from 'radix-ui'
import { useState, type ReactElement, type ReactNode } from 'react'
import { useStore } from '../lib/store.ts'
import { useMobile } from './shell.tsx'

export const GONE = 'Post excluído. Ele está na lixeira do vault.'

type Props = {
  title: string
  text: ReactNode
  ok: string
  busy: string
  run: () => Promise<boolean>
  children?: ReactElement
  open?: boolean
  set?: (open: boolean) => void
}

export function Confirm({ title, text, ok, busy, run, children, open, set }: Props) {
  const mobile = useMobile()
  const [inner, setInner] = useState(false)
  const [working, setWorking] = useState(false)
  const shown = open ?? inner
  const toggle = (o: boolean) => {
    if (working) return
    setInner(o)
    set?.(o)
  }
  const go = async () => {
    setWorking(true)
    const done = await run().catch(() => false)
    setWorking(false)
    if (done) toggle(false)
  }
  return (
    <AlertDialog.Root open={shown} onOpenChange={toggle}>
      {children && <AlertDialog.Trigger asChild>{children}</AlertDialog.Trigger>}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="veil" />
        <AlertDialog.Content className={mobile ? 'sheet gap-2 px-5' : 'dlg flex flex-col gap-2'}>
          <AlertDialog.Title className="text-[19px] font-bold tracking-[-0.01em]">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-[14px] leading-normal font-semibold text-text-muted">{text}</AlertDialog.Description>
          <div className={`mt-4 flex gap-2 ${mobile ? 'flex-col-reverse' : 'justify-end'}`}>
            <AlertDialog.Cancel asChild>
              <button type="button" className={`pill ghost ${mobile ? 'h-12' : ''}`} disabled={working}>
                Cancelar
              </button>
            </AlertDialog.Cancel>
            <button type="button" className={`pill danger ${mobile ? 'h-12' : ''}`} disabled={working} onClick={() => void go()}>
              {working && <LoaderCircle size={16} className="animate-spin" />}
              {working ? busy : ok}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

export function Trash({ run, children, open, set }: { run: () => Promise<boolean>; children?: ReactElement; open?: boolean; set?: (open: boolean) => void }) {
  const vault = useStore((s) => s.vault)
  return (
    <Confirm title="Excluir este post?" text={`Ele vai pra lixeira do vault (${vault}/.lixeira) e some da agenda.`} ok="Excluir post" busy="Excluindo…" run={run} open={open} set={set}>
      {children}
    </Confirm>
  )
}
