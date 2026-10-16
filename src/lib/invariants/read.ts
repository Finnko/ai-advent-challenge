import {
  CATEGORY_LABELS,
  INVARIANT_BLOCK_TITLE,
  invariantCode,
  type InvariantCategory,
  type InvariantRecord,
} from './types'

export function formatInvariantsBlock(
  records: InvariantRecord[],
  roleLine?: string | null,
): string {
  const groups = new Map<string, InvariantRecord[]>()
  for (const record of records) {
    const group = groups.get(record.category) ?? []
    group.push(record)
    groups.set(record.category, group)
  }
  const lines = [INVARIANT_BLOCK_TITLE]
  if (roleLine) {
    lines.push(roleLine)
  }
  for (const category of Object.keys(CATEGORY_LABELS) as InvariantCategory[]) {
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
