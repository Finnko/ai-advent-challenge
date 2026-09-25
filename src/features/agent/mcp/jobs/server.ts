import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { getJobsDb } from './db.ts'
import { registerJobsTools } from './register.ts'
import { createOpenMeteoSource } from './weather.ts'
import { createJobsToolkit } from './tools.ts'

const server = new McpServer({ name: 'agent-mcp-jobs', version: '1.0.0' })
const store = await getJobsDb()
const toolkit = createJobsToolkit({
  store,
  weather: createOpenMeteoSource(),
})
registerJobsTools(server, toolkit)

await server.connect(new StdioServerTransport())
