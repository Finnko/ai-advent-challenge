import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createFrankfurterSource } from './rates.ts'
import { registerMarketTools } from './register.ts'
import { createMarketToolkit } from './tools.ts'

const server = new McpServer({ name: 'agent-mcp-market', version: '1.0.0' })
const toolkit = createMarketToolkit({ rates: createFrankfurterSource() })
registerMarketTools(server, toolkit)

await server.connect(new StdioServerTransport())
