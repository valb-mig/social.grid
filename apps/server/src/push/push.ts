import { fail } from '@social-grid/core/fault.ts'
import type { Notice } from '@social-grid/core/plan/remind.ts'
import webpush, { WebPushError } from 'web-push'
import { z } from 'zod'
import type { State } from '../state.ts'

const FILE = 'push.json'
const MAX_SUBS = 10
const SUBJECT = 'https://github.com/valb-mig/social.grid'

export const SERVICES = [/^fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/]

export const sub = z.object({
  endpoint: z
    .string()
    .max(1024)
    .refine((u) => {
      try {
        const url = new URL(u)
        return url.protocol === 'https:' && !url.port && SERVICES.some((r) => r.test(url.hostname))
      } catch {
        return false
      }
    }, 'serviço de push desconhecido'),
  keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}={0,2}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{16,32}={0,2}$/) }),
})

export type Sub = z.infer<typeof sub>
type Data = { vapid: { publicKey: string; privateKey: string }; subs: (Sub & { at: string })[] }

export type Sender = (n: Notice) => Promise<void>

export type Push = {
  key(): string
  count(): number
  subscribe(s: unknown): Promise<void>
  unsubscribe(endpoint: string): Promise<void>
  send: Sender
}

export async function push(st: State): Promise<Push> {
  let data = await st.read<Data | null>(FILE, null)
  if (!data?.vapid?.publicKey || !data.vapid.privateKey) {
    data = { vapid: webpush.generateVAPIDKeys(), subs: [] }
    await st.write(FILE, data)
  }
  const d: Data = { vapid: data.vapid, subs: (data.subs ?? []).filter((s) => sub.safeParse(s).success) }
  const persist = () => st.write(FILE, d)

  async function unsubscribe(endpoint: string) {
    const before = d.subs.length
    d.subs = d.subs.filter((s) => s.endpoint !== endpoint)
    if (d.subs.length !== before) await persist()
  }

  return {
    key: () => d.vapid.publicKey,
    count: () => d.subs.length,
    async subscribe(input) {
      const s = sub.parse(input)
      const others = d.subs.filter((x) => x.endpoint !== s.endpoint)
      if (others.length >= MAX_SUBS) fail('refused', `no máximo ${MAX_SUBS} aparelhos`)
      d.subs = [...others, { endpoint: s.endpoint, keys: s.keys, at: new Date().toISOString() }]
      await persist()
    },
    unsubscribe,
    async send(n) {
      const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.key, ts: Date.now() })
      const results = await Promise.allSettled(
        d.subs.map((s) =>
          webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, {
            vapidDetails: { subject: SUBJECT, ...d.vapid },
            contentEncoding: 'aes128gcm',
            urgency: 'high',
            TTL: 3600,
            timeout: 15_000,
          }),
        ),
      )
      const gone = results.flatMap((r, i) => (r.status === 'rejected' && r.reason instanceof WebPushError && [404, 410].includes(r.reason.statusCode) ? [d.subs[i]!.endpoint] : []))
      for (const e of gone) await unsubscribe(e)
    },
  }
}
