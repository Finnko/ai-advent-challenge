import type { FinalCheck } from '@lib/day4'
import { Badge } from '@/components/ui/Badge'

export default function CheckPill({ check }: { check: FinalCheck }) {
  if (check === 'correct') {
    return <Badge variant="accent">Итог верный</Badge>
  }
  if (check === 'wrong') {
    return <Badge variant="danger">Не совпал</Badge>
  }
  return <Badge>Нет строки «Итог:»</Badge>
}
