import { callToolOn, createMcpHost, listToolsFor } from '@lib/mcp/client.server'
import { mcpRegistry } from './mcp-registry.server'

const host = createMcpHost(mcpRegistry)

export { callToolOn, listToolsFor }

export const listMcpTools = host.listTools
export const callToolOnServer = host.callToolOnServer
export const callTool = host.callTool
