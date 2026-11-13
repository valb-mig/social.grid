import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import { fail } from '@social-grid/core/fault.ts'

export type Content = SDKUserMessage['message']['content']

export class Queue implements AsyncIterable<SDKUserMessage> {
  private items: SDKUserMessage[] = []
  private waiters: ((r: IteratorResult<SDKUserMessage>) => void)[] = []
  private closed = false

  push(content: Content): void {
    if (this.closed) fail('conflict', 'conversa encerrada')
    const item = { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null } as SDKUserMessage
    const waiter = this.waiters.shift()
    if (waiter) waiter({ value: item, done: false })
    else this.items.push(item)
  }

  close(): void {
    this.closed = true
    for (const w of this.waiters.splice(0)) w({ value: undefined, done: true })
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return {
      next: () => {
        const item = this.items.shift()
        if (item) return Promise.resolve({ value: item, done: false })
        if (this.closed) return Promise.resolve({ value: undefined, done: true })
        return new Promise((resolve) => this.waiters.push(resolve))
      },
    }
  }
}
