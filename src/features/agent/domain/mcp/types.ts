export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type McpToolDescriptor = {
  name: string
  title: string | null
  description: string | null
  inputSchema: JsonValue
  server?: string
}

export type McpToolsResult =
  | { ok: true; tools: McpToolDescriptor[] }
  | { ok: false; error: string }

export type McpCallResult =
  | { ok: true; text: string }
  | { ok: false; error: string }
