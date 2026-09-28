import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

export async function serve(
  name: string,
  register: (server: McpServer) => void | Promise<void>,
): Promise<void> {
  const server = new McpServer({ name, version: '1.0.0' })
  await register(server)
  await server.connect(new StdioServerTransport())
}
