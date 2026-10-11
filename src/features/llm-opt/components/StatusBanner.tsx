import type { LocalLlmStatus } from '@lib/llm'
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
            {status.error ?? 'Нет ответа от /models'} Запустите{' '}
            <code className="text-xs">
              .local-llm-venv/bin/mlx_lm.server --model
              mlx-community/Qwen3-14B-4bit --port 8080
            </code>
            . Модель <code className="text-xs">{status.model}</code>, база{' '}
            <code className="text-xs">{status.baseUrl}</code>.
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
