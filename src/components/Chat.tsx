import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ChatResult } from '../lib/llm'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Alert } from '@/components/ui/Alert'

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  usage: ChatResult['usage']
  chars: number
  words: number
}

type ChatProps = {
  onSend: (prompt: string) => Promise<ChatResult>
  renderAssistant?: (message: ChatMessage) => ReactNode
  placeholder?: string
}

export default function Chat({
  onSend,
  renderAssistant,
  placeholder,
}: ChatProps) {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (loading || prompt.trim().length === 0) {
      return
    }
    const text = prompt.trim()
    setPrompt('')
    setError(null)
    setLoading(true)
    setMessages((prev) => [...prev, toMessage('user', text)])
    try {
      const result = await onSend(text)
      setMessages((prev) => [
        ...prev,
        toMessage('assistant', result.content, result.usage),
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 pb-2">
          {messages.map((message, i) =>
            message.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--accent)_18%,var(--surface-strong))] px-4 py-2.5 text-sm">
                  {message.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
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
                    {message.usage
                      ? ` · ${message.usage.completion_tokens} ток.`
                      : ''}
                  </p>
                </div>
              </div>
            ),
          )}
          {loading && (
            <div className="flex justify-start">
              <TypingDots />
            </div>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-3">{error}</Alert>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
        className="flex flex-col gap-3 border-t border-[var(--line)] pt-3"
      >
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder ?? 'Спроси у LLM что угодно…'}
          className="min-h-0"
          rows={2}
          disabled={loading}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={loading || prompt.trim().length === 0}
          >
            {loading ? 'Думает…' : 'Отправить'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function toMessage(
  role: 'user' | 'assistant',
  content: string,
  usage: ChatResult['usage'] = null,
): ChatMessage {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return { role, content, usage, chars: content.length, words }
}

function TypingDots() {
  return (
    <div
      className="flex items-center gap-1.5 py-3"
      aria-label="Ожидание ответа"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-dot h-2.5 w-2.5 rounded-full bg-[var(--accent)]"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}
