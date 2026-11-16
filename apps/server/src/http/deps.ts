import type { Bus } from '@social-grid/core/bus.ts'
import type { Ops } from '@social-grid/core/post/ops.ts'
import type { Repo } from '@social-grid/core/post/repo.ts'
import type { Source } from '@social-grid/core/project/project.ts'
import type { Store } from '@social-grid/vault/config.ts'
import type { Hub } from '../chat/hub.ts'
import type { Pics } from '../chat/pics.ts'
import type { Policy } from '../guard.ts'
import type { Link } from '../link.ts'
import type { Push } from '../push/push.ts'
import type { Skills } from '../skills/skills.ts'
import type { Room, Who } from '../ws.ts'

export type Deps = {
  ops: Ops
  repo: Repo
  cfg: Store
  projects: Source
  bus: Bus
  now: () => Date
  policy: Policy
  push: Push | null
  link?: Link | null
  chat: Hub | null
  pics?: Pics | null
  skills: Skills
  room: Room
  who?: Who
  web: string | null
  vault: string
  home: string
  log?: boolean
}
