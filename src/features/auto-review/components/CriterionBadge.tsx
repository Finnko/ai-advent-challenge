import { Badge } from '@/components/ui/Badge'
import type { CriterionStatus } from '../types'
import { CRITERION_STATUS_LABELS } from '../types'

const VARIANTS: Record<CriterionStatus, 'success' | 'danger' | 'warn'> = {
  pass: 'success',
  fail: 'danger',
  not_checked: 'warn',
}

export default function CriterionBadge({
  status,
}: {
  status: CriterionStatus
}) {
  return (
    <Badge variant={VARIANTS[status]} className="text-[11px]">
      {CRITERION_STATUS_LABELS[status]}
    </Badge>
  )
}
