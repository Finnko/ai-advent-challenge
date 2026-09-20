import { useEffect, useRef } from 'react'
import type { AgentRunResult } from '../domain/agent'
import type { TaskEvent } from '../domain/task/types'
import AssistantMessage from './AssistantMessage'
import TaskEventRow from './TaskEventRow'
import ForkButton from './ForkButton'
import UserBubble from './UserBubble'
import TypingDots from '@/components/TypingDots'

export type ThreadMessage = {
  id?: number
  role: 'user' | 'assistant' | 'task'
  content: string
  run?: AgentRunResult
  taskEvent?: TaskEvent
}

type ChatThreadProps = {
  messages: ThreadMessage[]
  running: boolean
  onFork?: (messageId: number) => void
  forkDisabled?: boolean
}

export default function ChatThread({
  messages,
  running,
  onFork,
  forkDisabled,
}: ChatThreadProps) {
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
      {messages.map((message, i) => {
        if (message.role === 'task') {
          return message.taskEvent ? (
            <TaskEventRow key={message.id ?? i} event={message.taskEvent} />
          ) : null
        }
        return message.role === 'user' ? (
          <div key={message.id ?? i} className="flex flex-col items-end gap-1">
            <UserBubble text={message.content} />
            {onFork && message.id !== undefined && (
              <ForkButton
                disabled={forkDisabled}
                onFork={() => onFork(message.id as number)}
              />
            )}
          </div>
        ) : (
          <div key={message.id ?? i} className="flex justify-start">
            <div className="flex max-w-[95%] flex-col gap-2">
              <AssistantMessage run={message.run!} />
              {onFork && message.id !== undefined && (
                <ForkButton
                  disabled={forkDisabled}
                  onFork={() => onFork(message.id as number)}
                />
              )}
            </div>
          </div>
        )
      })}
      {running && (
        <div className="flex items-center gap-2" aria-label="Ожидание ответа">
          <TypingDots />
          <span className="demo-muted text-xs">Агент думает и действует…</span>
        </div>
      )}
    </div>
  )
}
