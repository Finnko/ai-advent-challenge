import { serve } from '../shared/serve.ts'
import { createFrankfurterSource } from './rates.ts'
import { registerMarketTools } from './register.ts'
import { createMarketToolkit } from './tools.ts'

await serve('agent-mcp-market', (server) => {
  const toolkit = createMarketToolkit({ rates: createFrankfurterSource() })
  registerMarketTools(server, toolkit)
})
