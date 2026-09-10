import { useEffect, useRef } from 'react'
import type { AgentRunResult } from '../../lib/agent'
import AssistantMessage from './AssistantMessage'
import TypingDots from '../TypingDots'

export type ThreadMessage = {
  role: 'user' | 'assistant'
  content: string
  run?: AgentRunResult
}

type ChatThreadProps = {
  messages: ThreadMessage[]
  running: boolean
}

export default function ChatThread({ messages, running }: ChatThreadProps) {
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight })
  }, [messages, running])

  if (messages.length === 0 && !running) {
    return null
  }

  return (
    <div
      ref={threadRef}
      className="flex min-h-[24rem] flex-1 flex-col gap-4 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
    >
      {messages.map((message, i) =>
        message.role === 'user' ? (
          <UserBubble key={i} text={message.content} />
        ) : (
          <div key={i} className="flex justify-start">
            <div className="flex max-w-[95%] flex-col gap-2">
              <AssistantMessage run={message.run!} />
            </div>
          </div>
        ),
      )}
      {running && (
        <div className="flex items-center gap-2" aria-label="Ожидание ответа">
          <TypingDots />
          <span className="demo-muted text-xs">Агент думает и действует…</span>
        </div>
      )}
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--accent)_18%,var(--surface-strong))] px-4 py-2.5 text-sm">
        {text}
      </div>
    </div>
  )
}
