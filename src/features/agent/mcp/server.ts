import { serve } from '@lib/mcp/serve.ts'
import { registerDemoTools } from './tools.ts'

await serve('agent-mcp-demo', registerDemoTools)
