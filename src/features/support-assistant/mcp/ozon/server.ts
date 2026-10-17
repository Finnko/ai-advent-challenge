import { serve } from '@lib/mcp/serve.ts'
import { registerOzonTools } from './register.ts'
import { createOzonSource, resolveFixturesRoot } from './source.ts'
import { createOzonToolkit } from './tools.ts'

export function startOzonServer(root: string): Promise<void> {
  return serve('support-mcp-ozon', (server) => {
    registerOzonTools(server, createOzonToolkit(createOzonSource(root)))
  })
}

await startOzonServer(resolveFixturesRoot())
