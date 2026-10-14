import { serve } from '@lib/mcp/serve.ts'
import { registerResearchTools } from './register.ts'
import { createFileReportsStore } from './reports.ts'
import { createResearchToolkit } from './tools.ts'
import { createWikipediaSource } from './web.ts'

await serve('agent-mcp-research', (server) => {
  const toolkit = createResearchToolkit({
    web: createWikipediaSource(),
    reports: createFileReportsStore(),
  })
  registerResearchTools(server, toolkit)
})
