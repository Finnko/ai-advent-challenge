import type { LocalLlmStatus } from '../types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'

type StatusBannerProps = {
  status: LocalLlmStatus | undefined
  isPending: boolean
  onRetry: () => void
}

export default function StatusBanner({
  status,
  isPending,
  onRetry,
}: StatusBannerProps) {
  if (!status || status.available) {
    return null
  }

  return (
    <Alert variant="destructive">
      <div className="flex items-start justify-between gap-3">
        <div>
          <AlertTitle>Локальный сервер не отвечает</AlertTitle>
          <AlertDescription>
            {status.error} Проверь, что сервер запущен на{' '}
            <code className="text-xs">{status.baseUrl}</code>. Модель{' '}
            <code className="text-xs">{status.model}</code>.
          </AlertDescription>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          disabled={isPending}
        >
          Проверить
        </Button>
      </div>
    </Alert>
  )
}
