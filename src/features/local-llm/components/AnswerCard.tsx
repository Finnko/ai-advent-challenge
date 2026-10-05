import type { LocalLlmAnswer } from '../types'
import MetricsRow from './MetricsRow'
import TypingDots from '@/components/TypingDots'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export type AnswerCardProps = {
  title: string
  prompt: string
  state: 'running' | 'done' | 'error'
  result?: LocalLlmAnswer
  error?: string
}

export default function AnswerCard({
  title,
  prompt,
  state,
  result,
  error,
}: AnswerCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        {state === 'running' && <TypingDots />}
        {state === 'done' && <Badge variant="success">готово</Badge>}
        {state === 'error' && <Badge variant="danger">ошибка</Badge>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="demo-muted m-0 text-xs">{prompt}</p>

        {state === 'running' && (
          <p className="demo-muted m-0 text-sm">Модель генерирует ответ…</p>
        )}

        {state === 'error' && (
          <Alert variant="destructive">
            {error ?? 'Не удалось получить ответ'}
          </Alert>
        )}

        {state === 'done' && result && (
          <>
            <MetricsRow result={result} />
            <div className="whitespace-pre-wrap text-sm text-ink">
              {result.content || '— пустой ответ —'}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
