import type { Post } from '@social-grid/core/post/post.ts'
import { ExternalLink, Sparkles, Trash2 } from 'lucide-react'
import { ContextMenu } from 'radix-ui'
import { useState, type ReactElement } from 'react'
import { useLocation } from 'wouter'
import { api } from '../lib/api.ts'
import { ask } from '../lib/novo.ts'
import { useStore } from '../lib/store.ts'
import { GONE, Trash } from './confirm.tsx'
import { useMobile } from './shell.tsx'

export function PostMenu({ post, children }: { post: Post; children: ReactElement }) {
  const mobile = useMobile()
  const [, go] = useLocation()
  const [sure, setSure] = useState(false)
  const drop = useStore((s) => s.drop)
  const note = useStore((s) => s.note)
  const fail = useStore((s) => s.fail)
  if (mobile) return children
  const run = async () => {
    try {
      await api.remove(post.id)
    } catch (e) {
      fail(e instanceof Error ? e.message : 'não deu para excluir o post')
      return false
    }
    drop(post.id)
    note(GONE)
    return true
  }
  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="pop w-[230px]" collisionPadding={16}>
            <ContextMenu.Label className="truncate px-2.5 pt-1 pb-1.5 text-[11.5px] font-extrabold text-text-faint">{post.title}</ContextMenu.Label>
            <ContextMenu.Item className="opt text-[13.5px] font-bold outline-none" onSelect={() => go(`/post/${post.id}`)}>
              <ExternalLink size={15} className="text-text-faint" />
              Abrir post
            </ContextMenu.Item>
            <ContextMenu.Item className="opt text-[13.5px] font-bold outline-none" onSelect={() => go(ask({ project: post.project, post: post.id }))}>
              <Sparkles size={15} className="text-ai" />
              Pedir ajuste à IA
            </ContextMenu.Item>
            <ContextMenu.Separator className="mx-2 my-1 h-px bg-border" />
            <ContextMenu.Item className="opt text-[13.5px] font-bold text-danger outline-none" onSelect={() => setSure(true)}>
              <Trash2 size={15} />
              Excluir post
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
      <Trash open={sure} set={setSure} run={run} />
    </>
  )
}
