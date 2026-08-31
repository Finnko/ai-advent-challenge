import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { sendPrompt } from '../lib/chat'

export const Route = createFileRoute('/')({ component: App })

type Message = { role: 'user' | 'assistant'; content: string }

function App() {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (loading || prompt.trim().length === 0) return
    const userMessage = prompt.trim()
    setPrompt('')
    setError(null)
    setLoading(true)
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    try {
      const content = await sendPrompt({ data: userMessage })
      setMessages((prev) => [...prev, { role: 'assistant', content }])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-wrap flex h-[calc(100dvh-4.5rem)] flex-col px-4 pb-5 pt-5">
      <section className="demo-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="mb-5 mt-2">
          <p className="island-kicker mb-2">AI Advent Challenge · Day 1</p>
          <h1 className="demo-title">Chat with DeepSeek</h1>
        </header>

        <div className="mb-3 min-h-0 flex-1 overflow-y-auto pb-2">
          <div className="flex flex-col gap-4">
            {messages.map((message, i) =>
              message.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--lagoon)_18%,var(--surface-strong))] px-4 py-2.5 text-sm">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <pre className="demo-code-block max-w-[85%] whitespace-pre-wrap text-sm">
                    {message.content}
                  </pre>
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

        {error && <div className="demo-alert demo-alert-danger mb-3">{error}</div>}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="flex flex-col gap-3 border-t border-[var(--line)] pt-3"
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask the LLM anything…"
            className="demo-textarea min-h-0"
            rows={2}
            disabled={loading}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="demo-button"
              disabled={loading || prompt.trim().length === 0}
            >
              {loading ? 'Thinking…' : 'Send'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-3" aria-label="Waiting for response">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-dot h-2.5 w-2.5 rounded-full bg-[var(--lagoon)]"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}
