import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ChatResult } from '../lib/llm'
import ChatMessageView from './ChatMessageView'
import TypingDots from './TypingDots'
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
          {messages.map((message, i) => (
            <ChatMessageView
              key={i}
              message={message}
              renderAssistant={renderAssistant}
            />
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="py-3">
                <TypingDots />
              </div>
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

