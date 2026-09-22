import { createServerFn } from '@tanstack/react-start'
import { listMcpTools as listMcpToolsInServer } from '../server/mcp.server'

export const listMcpTools = createServerFn({ method: 'GET' }).handler(
  async () => listMcpToolsInServer(),
)
