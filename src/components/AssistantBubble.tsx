import type { ReactNode } from 'react'
import type { ChatMessage } from './Chat'

export default function AssistantBubble({
  message,
  renderAssistant,
}: {
  message: ChatMessage
  renderAssistant?: (message: ChatMessage) => ReactNode
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        {renderAssistant ? (
          renderAssistant(message)
        ) : (
          <pre className="demo-code-block whitespace-pre-wrap text-sm">
            {message.content}
          </pre>
        )}
        <p className="demo-muted mt-1.5 text-xs">
          {message.chars} симв. · {message.words} слов
          {message.usage ? ` · ${message.usage.completion_tokens} ток.` : ''}
        </p>
      </div>
    </div>
  )
}
