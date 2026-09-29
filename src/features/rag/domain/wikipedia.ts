import { countTokens } from 'gpt-tokenizer'

export type WikiSection = {
  heading: string | null
  level: number
  path: string[]
  start: number
  end: number
  tokens: number
}

const HEADING_RE = /^(={2,6})\s*(.+?)\s*\1\s*$/

export function parseWikiSections(text: string): WikiSection[] {
  const sections: WikiSection[] = []
  const stack: { heading: string; level: number }[] = []
  let current: {
    heading: string | null
    level: number
    path: string[]
    start: number
  } = { heading: null, level: 0, path: [], start: 0 }

  const flush = (end: number) => {
    const body = text.slice(current.start, end)
    if (body.trim().length > 0) {
      sections.push({
        heading: current.heading,
        level: current.level,
        path: current.path,
        start: current.start,
        end,
        tokens: countTokens(body),
      })
    }
  }

  const lines = text.split('\n')
  let offset = 0
  for (const line of lines) {
    const match = HEADING_RE.exec(line)
    if (match) {
      flush(offset)
      const level = match[1].length
      const heading = match[2]
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }
      stack.push({ heading, level })
      current = {
        heading,
        level,
        path: stack.map((item) => item.heading),
        start: offset,
      }
    }
    offset += line.length + 1
  }
  flush(text.length)
  return sections
}

export function findSectionIndex(
  sections: WikiSection[],
  offset: number,
): number {
  for (let index = sections.length - 1; index >= 0; index -= 1) {
    if (offset >= sections[index].start) {
      return index
    }
  }
  return sections.length > 0 ? 0 : -1
}
