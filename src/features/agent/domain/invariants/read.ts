import type { AgentRole, SystemBlock } from '../agent'
import {
  CATEGORY_LABELS,
  INVARIANT_BLOCK_TITLE,
  invariantCode,
  type InvariantRecord,
} from './types'

const ROLE_LABELS: Record<AgentRole, string> = {
  employee: 'сотрудник',
  manager: 'руководитель',
}

export function formatInvariantsBlock(
  records: InvariantRecord[],
  role: AgentRole,
): string {
  const groups = new Map<string, InvariantRecord[]>()
  for (const record of records) {
    const group = groups.get(record.category) ?? []
    group.push(record)
    groups.set(record.category, group)
  }
  const lines = [
    INVARIANT_BLOCK_TITLE,
    `Текущая роль пользователя: ${ROLE_LABELS[role]} (${role}). Ролевые правила применяй только к этой роли.`,
  ]
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

export function buildInvariantBlocks(
  records: InvariantRecord[],
  role: AgentRole,
): SystemBlock[] {
  return records.length === 0
    ? []
    : [{ kind: 'invariants', content: formatInvariantsBlock(records, role) }]
}
