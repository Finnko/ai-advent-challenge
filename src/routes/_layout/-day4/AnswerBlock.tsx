import type { Answer } from './types'
import { Alert } from '@/components/ui/Alert'

export default function AnswerBlock({ answer }: { answer: Answer }) {
  return (
    <div>
      {answer.content.trim().length === 0 ? (
        <Alert>
          <p className="m-0 text-sm">
            Модель вернула пустой ответ. Попробуй ещё раз.
          </p>
        </Alert>
      ) : (
        <pre className="demo-code-block whitespace-pre-wrap text-sm">
          {answer.content}
        </pre>
      )}
      <p className="demo-muted mt-1.5 text-xs">
        {answer.chars ?? 0} симв. · {answer.words ?? 0} слов
        {answer.usage ? ` · ${answer.usage.completion_tokens} ток.` : ''}
      </p>
    </div>
  )
}
