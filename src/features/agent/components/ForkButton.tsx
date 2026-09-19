import { GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function ForkButton({
  disabled,
  onFork,
}: {
  disabled?: boolean
  onFork: () => void
}) {
  return (
    <Button
      variant="secondary"
      size="xs"
      onClick={onFork}
      disabled={disabled}
      title="Создать ветку от этого сообщения"
    >
      <GitBranch className="h-3 w-3" />
      ветка
    </Button>
  )
}
