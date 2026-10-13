export type ToolResult =
  { ok: true; text: string } | { ok: false; text: string }

export type ToolResponse = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export function ok(text: string): ToolResult {
  return { ok: true, text }
}

export function fail(text: string): ToolResult {
  return { ok: false, text }
}

export function toResponse(result: ToolResult): ToolResponse {
  if (result.ok) {
    return { content: [{ type: 'text', text: result.text }] }
  }
  return {
    content: [{ type: 'text', text: result.text }],
    isError: true,
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
