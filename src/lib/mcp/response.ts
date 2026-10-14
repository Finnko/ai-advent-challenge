import type { StructuredContent } from './types'

export type ToolResult =
  | { ok: true; text: string; structured?: StructuredContent }
  | { ok: false; text: string }

export type ToolResponse = {
  content: Array<{ type: 'text'; text: string }>
  structuredContent?: StructuredContent
  isError?: boolean
}

export function ok(text: string, structured?: StructuredContent): ToolResult {
  return { ok: true, text, structured }
}

export function fail(text: string): ToolResult {
  return { ok: false, text }
}

export function toResponse(result: ToolResult): ToolResponse {
  if (result.ok) {
    return {
      content: [{ type: 'text', text: result.text }],
      structuredContent: result.structured,
    }
  }
  return {
    content: [{ type: 'text', text: result.text }],
    isError: true,
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
