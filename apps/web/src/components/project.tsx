import { mono } from '@social-grid/core/project/project.ts'
import { GERAL, type Post } from '@social-grid/core/post/post.ts'
import { useStore } from '../lib/store.ts'
import { api } from '../lib/api.ts'
import { Badge } from './ui.tsx'

export function useProject(id: string) {
  return useStore((s) => s.projects.find((p) => p.id === id))
}

export function ProjectIcon({ id, size = 44, radius, className = '' }: { id: string; size?: number; radius?: number; className?: string }) {
  const p = useProject(id)
  const r = radius ?? Math.round(size * 0.27)
  const style = { width: size, height: size, borderRadius: r }
  if (id === GERAL) return <img className={`ico ${className}`} style={{ ...style, background: '#fff' }} src="/logo.svg" alt="" />
  if (p?.icon) return <img className={`ico ${className}`} style={style} src={api.icon(id)} alt="" loading="lazy" />
  return (
    <span className={`ico mono-ico ${className}`} style={{ ...style, fontSize: Math.round(size * 0.36) }}>
      {p?.mono ?? mono(id)}
    </span>
  )
}

export function PostIcon({ post, size = 44, sm = false, dot = false, rot = 0 }: { post: Post; size?: number; sm?: boolean; dot?: boolean; rot?: number }) {
  const posted = post.status === 'posted'
  return (
    <span className="relative block flex-none" style={{ transform: rot ? `rotate(${rot}deg)` : undefined }}>
      {dot && !posted && (
        <i
          className="absolute -top-[3px] -left-[3px] z-10 size-[11px] rounded-full border-2 border-surface"
          style={{ background: post.status === 'ready' ? 'var(--color-ready)' : 'var(--color-draft)' }}
        />
      )}
      <span className={posted ? 'block opacity-55 grayscale-[.7]' : 'block'}>
        <ProjectIcon id={post.project} size={size} />
      </span>
      <span className={posted ? 'opacity-55' : ''}>
        <Badge net={post.network} sm={sm} />
      </span>
    </span>
  )
}

export function useName(id: string) {
  const p = useProject(id)
  return id === GERAL ? 'geral' : (p?.name ?? id)
}
