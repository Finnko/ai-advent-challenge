import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerDemoTools } from './tools.ts'

const server = new McpServer({ name: 'agent-mcp-demo', version: '1.0.0' })
registerDemoTools(server)

await server.connect(new StdioServerTransport())
