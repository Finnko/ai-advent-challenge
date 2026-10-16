import { formatInvariantsBlock } from '@lib/invariants/read'
import type { InvariantRecord } from '@lib/invariants/types'
import type { AgentRole, SystemBlock } from '../agent'

const ROLE_LABELS: Record<AgentRole, string> = {
  employee: 'сотрудник',
  manager: 'руководитель',
}

export function buildInvariantBlocks(
  records: InvariantRecord[],
  role: AgentRole,
): SystemBlock[] {
  if (records.length === 0) {
    return []
  }
  const roleLine = `Текущая роль пользователя: ${ROLE_LABELS[role]} (${role}). Ролевые правила применяй только к этой роли.`
  return [
    { kind: 'invariants', content: formatInvariantsBlock(records, roleLine) },
  ]
}

export { formatInvariantsBlock }
