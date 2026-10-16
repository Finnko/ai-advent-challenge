import { serve } from '@lib/mcp/serve.ts'
import { registerFilesTools } from './register.ts'
import { createSandbox, resolveRoot } from './sandbox.ts'
import { createFilesSource } from './source.ts'
import { createFilesToolkit } from './tools.ts'

export function startFilesServer(root: string): Promise<void> {
  return serve('dev-assistant-mcp-files', (server) => {
    const sandbox = createSandbox(root)
    const toolkit = createFilesToolkit({
      sandbox,
      source: createFilesSource({ sandbox }),
    })
    registerFilesTools(server, toolkit)
  })
}

await startFilesServer(resolveRoot())
