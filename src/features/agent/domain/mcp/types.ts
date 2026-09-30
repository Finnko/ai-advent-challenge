export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export const MCP_TOOL_REPORT_MAX_CHARS = 4000

export type McpToolDescriptor = {
  name: string
  title: string | null
  description: string | null
  inputSchema: JsonValue
  server?: string
  mutating: boolean
}

export type McpToolsResult =
  { ok: true; tools: McpToolDescriptor[] } | { ok: false; error: string }

export type McpCallResult =
  { ok: true; text: string } | { ok: false; error: string }
