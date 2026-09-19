import type { Answer } from './types'
import { Alert } from '@/components/ui/Alert'

export default function AnswerBlock({
  answer,
  savedPath,
}: {
  answer: Answer
  savedPath: string | null
}) {
  return (
    <div>
      {answer.content.trim().length === 0 ? (
        <Alert>
          <p className="m-0 text-sm">
            Модель вернула пустой ответ. Попробуй ещё раз.
          </p>
        </Alert>
      ) : (
        <pre className="demo-code-block select-text whitespace-pre-wrap text-sm">
          {answer.content}
        </pre>
      )}
      <p className="demo-muted mt-1.5 text-xs">
        {answer.chars ?? 0} симв. · {answer.words ?? 0} слов
        {answer.usage
          ? ` · prompt ${answer.usage.prompt_tokens} → completion ${answer.usage.completion_tokens} ток.`
          : ''}
        {typeof answer.latencyMs === 'number'
          ? ` · ${answer.latencyMs} мс`
          : ''}
      </p>
      {savedPath && (
        <p className="demo-muted m-0 mt-1 text-xs">Сохранено: {savedPath}</p>
      )}
    </div>
  )
}
