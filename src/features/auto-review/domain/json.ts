export function stripFences(content: string): string {
  const match = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return match ? match[1].trim() : content.trim()
}

export function extractJsonObject(content: string): string | null {
  const start = content.indexOf('{')
  if (start < 0) {
    return null
  }
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < content.length; index += 1) {
    const char = content[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') {
      depth += 1
      continue
    }
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return content.slice(start, index + 1)
      }
    }
  }
  return null
}

export function parseJsonObject(content: string): unknown {
  for (const candidate of [stripFences(content), extractJsonObject(content)]) {
    if (!candidate) {
      continue
    }
    try {
      return JSON.parse(candidate) as unknown
    } catch {
      continue
    }
  }
  return null
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}
