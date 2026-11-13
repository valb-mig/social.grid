import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { bus } from '@social-grid/core/bus.ts'
import { ops } from '@social-grid/core/post/ops.ts'
import { open } from '@social-grid/vault/open.ts'
import { instructions } from './instructions.ts'
import { reply, tools, type Ctx } from './tools.ts'

const v = open()
const now = () => new Date()

const ctx: Ctx = {
  ops: ops({ repo: v.repo, config: v.cfg.load, bus: bus(), now, known: async (id) => !!(await v.projects.get(id)) }),
  repo: v.repo,
  config: v.cfg.load,
  projects: v.projects,
  roots: async () => [await v.cfg.projects(), v.dir],
  now,
}

const server = new McpServer({ name: 'social-grid', version: '0.1.0' }, { instructions })

for (const t of tools) {
  server.registerTool(
    t.name,
    { description: t.description, inputSchema: t.shape, annotations: { readOnlyHint: t.read, destructiveHint: false } },
    ((args: unknown) => reply(() => t.run(ctx, args))) as never,
  )
}

await server.connect(new StdioServerTransport())
