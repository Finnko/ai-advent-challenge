import { serve } from './shared/serve.ts'
import { registerDemoTools } from './tools.ts'

await serve('agent-mcp-demo', registerDemoTools)
