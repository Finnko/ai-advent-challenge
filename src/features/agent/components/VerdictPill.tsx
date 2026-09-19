import type { JudgeVerdict } from '../domain/agent'
import { Badge } from '@/components/ui/Badge'

export default function VerdictPill({ verdict }: { verdict: JudgeVerdict }) {
  const failed = verdict.status === 'fail'

  return (
    <Badge variant={failed ? 'danger' : 'default'} title={verdict.message}>
      {verdict.judge}: {verdict.status === 'pass' ? 'ок' : 'нарушение'}
    </Badge>
  )
}
