import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerResearchTools } from './register.ts'
import { createFileReportsStore } from './reports.ts'
import { createResearchToolkit } from './tools.ts'
import { createWikipediaSource } from './web.ts'

const server = new McpServer({ name: 'agent-mcp-research', version: '1.0.0' })
const toolkit = createResearchToolkit({
  web: createWikipediaSource(),
  reports: createFileReportsStore(),
})
registerResearchTools(server, toolkit)

await server.connect(new StdioServerTransport())
