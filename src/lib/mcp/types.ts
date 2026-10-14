export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type StructuredContent = { [key: string]: unknown }

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
  | { ok: true; text: string; structured?: StructuredContent }
  | { ok: false; error: string }

export type ToolArgs = Record<string, unknown>
