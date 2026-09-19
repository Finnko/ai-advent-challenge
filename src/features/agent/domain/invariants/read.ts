import type { SystemBlock } from '../agent'
import {
  CATEGORY_LABELS,
  INVARIANT_BLOCK_TITLE,
  invariantCode,
  type InvariantRecord,
} from './types'

export function formatInvariantsBlock(records: InvariantRecord[]): string {
  const groups = new Map<string, InvariantRecord[]>()
  for (const record of records) {
    const group = groups.get(record.category) ?? []
    group.push(record)
    groups.set(record.category, group)
  }
  const lines = [INVARIANT_BLOCK_TITLE]
  for (const category of Object.keys(CATEGORY_LABELS) as InvariantRecord['category'][]) {
    const group = groups.get(category)
    if (!group || group.length === 0) {
      continue
    }
    lines.push('', `${CATEGORY_LABELS[category]}:`)
    for (const record of group) {
      lines.push(`${invariantCode(record)} — ${record.title}: ${record.text}`)
    }
  }
  return lines.join('\n')
}

export function buildInvariantBlocks(records: InvariantRecord[]): SystemBlock[] {
  return records.length === 0
    ? []
    : [{ kind: 'invariants', content: formatInvariantsBlock(records) }]
}
