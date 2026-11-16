import { kind } from '@social-grid/core/media.ts'
import { shape } from '@social-grid/core/network/index.ts'
import type { Post } from '@social-grid/core/post/post.ts'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { api } from '../lib/api.ts'

export function Thumb({ post, name, className = '' }: { post: Post; name: string; className?: string }) {
  const src = api.media(post.id, name)
  return kind(name) === 'video' ? (
    <video className={`size-full object-cover ${className}`} src={src} muted playsInline preload="metadata" />
  ) : (
    <img className={`size-full object-cover ${className}`} src={src} alt="" draggable={false} />
  )
}

function Slide({ post, name }: { post: Post; name: string }) {
  const src = api.media(post.id, name)
  return kind(name) === 'video' ? (
    <video className="size-full bg-black object-contain" src={src} controls playsInline preload="metadata" />
  ) : (
    <img className="size-full cursor-zoom-in object-cover [:fullscreen_&]:cursor-zoom-out [:fullscreen_&]:object-contain" src={src} alt="" draggable={false} />
  )
}

const FRAMES = { vertical: 'aspect-[9/16] max-h-[68dvh]', paisagem: 'aspect-video', quadrado: 'aspect-square', retrato: 'aspect-[4/5]' }

const frame = (p: Post) => (p.network === 'linkedin' && p.format === 'post' ? FRAMES.quadrado : FRAMES[shape(p.network, p.format)])

export function Slides({ post }: { post: Post }) {
  const box = useRef<HTMLDivElement>(null)
  const rail = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const now = useRef(0)
  const n = post.media.length

  useEffect(() => {
    now.current = at
    Array.from(rail.current?.children ?? []).forEach((c, i) => i !== at && c.querySelector('video')?.pause())
  }, [at])

  useEffect(() => {
    const el = rail.current
    if (!el) return
    let w = el.clientWidth
    const o = new ResizeObserver(() => {
      if (el.clientWidth === w) return
      w = el.clientWidth
      el.scrollLeft = now.current * w
    })
    o.observe(el)
    return () => o.disconnect()
  }, [n > 0])

  const go = (i: number) => {
    const el = rail.current
    if (el) el.scrollTo({ left: Math.max(0, Math.min(n - 1, i)) * el.clientWidth, behavior: 'smooth' })
  }

  const zoom = (ev: MouseEvent) => {
    const el = box.current
    if (!(ev.target instanceof HTMLImageElement) || !el?.requestFullscreen) return
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    else void el.requestFullscreen().catch(() => undefined)
  }

  if (!n) return null

  return (
    <div className="flex flex-col gap-2.5">
      <div ref={box} onClick={zoom} className={`relative mx-auto w-full ${frame(post)} overflow-hidden rounded-xl bg-surface-3 [&:fullscreen]:rounded-none [&:fullscreen]:bg-black`}>
        <div
          ref={rail}
          aria-label={`Mídia ${at + 1} de ${n}`}
          className="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-none"
          onScroll={(ev) => {
            const el = ev.currentTarget
            setAt(Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / el.clientWidth))))
          }}
        >
          {post.media.map((m) => (
            <div key={m} className="size-full flex-none snap-start snap-always">
              <Slide post={post} name={m} />
            </div>
          ))}
        </div>
        {n > 1 && (
          <>
            <span className="pointer-events-none absolute top-2.5 right-2.5 grid h-6 place-items-center rounded-full bg-black/55 px-2.5 font-mono text-[11.5px] font-medium">
              {at + 1}/{n}
            </span>
            {at > 0 && (
              <button type="button" aria-label="Mídia anterior" className="absolute top-1/2 left-2.5 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 pointer-fine:grid" onClick={() => go(at - 1)}>
                <ChevronLeft size={18} />
              </button>
            )}
            {at < n - 1 && (
              <button type="button" aria-label="Próxima mídia" className="absolute top-1/2 right-2.5 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 pointer-fine:grid" onClick={() => go(at + 1)}>
                <ChevronRight size={18} />
              </button>
            )}
          </>
        )}
      </div>
      {n > 1 && (
        <div className="flex justify-center">
          {post.media.map((m, i) => (
            <button key={m} type="button" aria-label={`Ir para a mídia ${i + 1}`} aria-current={i === at} className="grid h-4 place-items-center px-[3px]" onClick={() => go(i)}>
              <i className="size-1.5 rounded-full transition-colors" style={{ background: i === at ? 'var(--color-linkedin)' : 'var(--color-text-faint)' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Strip({ post }: { post: Post }) {
  const n = post.media.length
  if (!n) return null
  return (
    <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-1.5 overflow-x-auto overscroll-x-contain px-4 scroll-none">
      {post.media.map((m) => (
        <div key={m} className={`aspect-[4/5] snap-start overflow-hidden rounded-md bg-surface-3 ${n > 3 ? 'w-[29%] flex-none' : 'min-w-0 flex-1'}`}>
          <Thumb post={post} name={m} />
        </div>
      ))}
    </div>
  )
}
