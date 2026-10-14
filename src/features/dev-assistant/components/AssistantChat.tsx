import { useState } from 'react'
import { useAssistantAnswer } from '../api/use-assistant-answer'
import { helpText, parseInput } from '../data/help'
import type { AnswerGenerator, DevAssistantAnswer } from '../types'
import AnswerSources from './AnswerSources'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'

type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | {
      id: string
      role: 'assistant'
      text: string
      result?: DevAssistantAnswer
      pending?: boolean
      error?: string
    }

const GENERATORS: AnswerGenerator[] = ['cloud', 'local']
const GENERATOR_LABELS: Record<AnswerGenerator, string> = {
  cloud: 'облако',
  local: 'локально',
}

let counter = 0
function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}

type AssistantMessage = Extract<ChatMessage, { role: 'assistant' }>

function renderAssistantBody(message: AssistantMessage) {
  if (message.pending) {
    return <span className="demo-muted">Думаю…</span>
  }
  if (message.error) {
    return <Alert variant="destructive">{message.error}</Alert>
  }
  return (
    <>
      <p className="m-0 whitespace-pre-wrap leading-relaxed text-[var(--ink)]">
        {message.text}
      </p>
      {message.result && <AnswerSources result={message.result} />}
    </>
  )
}

export default function AssistantChat({
  onAnswer,
}: {
  onAnswer?: (result: DevAssistantAnswer) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [generator, setGenerator] = useState<AnswerGenerator>('cloud')
  const answer = useAssistantAnswer()

  const send = async () => {
    const parsed = parseInput(draft)
    if (parsed.kind === 'empty') {
      return
    }
    const raw = draft.trim()
    setDraft('')

    if (parsed.kind === 'help') {
      setMessages((prev) => [
        ...prev,
        { id: nextId('u'), role: 'user', text: raw },
        { id: nextId('a'), role: 'assistant', text: helpText() },
      ])
      return
    }

    const pendingId = nextId('a')
    setMessages((prev) => [
      ...prev,
      { id: nextId('u'), role: 'user', text: raw },
      { id: pendingId, role: 'assistant', text: '', pending: true },
    ])
    try {
      const result = await answer.mutateAsync({
        question: parsed.question,
        generator,
      })
      setMessages((prev) =>
        prev.map((message) =>
          message.id === pendingId
            ? { id: pendingId, role: 'assistant', text: result.answer, result }
            : message,
        ),
      )
      onAnswer?.(result)
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause)
      setMessages((prev) =>
        prev.map((message) =>
          message.id === pendingId
            ? { id: pendingId, role: 'assistant', text: '', error }
            : message,
        ),
      )
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Чат с ассистентом</CardTitle>
        <div className="flex items-center gap-1">
          {GENERATORS.map((id) => (
            <Button
              key={id}
              size="xs"
              variant={generator === id ? 'default' : 'secondary'}
              onClick={() => setGenerator(id)}
            >
              {GENERATOR_LABELS[id]}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="mt-3 flex flex-col gap-3">
        <div className="flex max-h-[30rem] flex-col gap-3 overflow-auto pr-1">
          {messages.length === 0 && (
            <p className="demo-muted m-0 text-sm">
              Спросите что-нибудь о проекте или введите{' '}
              <span className="font-mono">/help</span>.
            </p>
          )}
          {messages.map((message) =>
            message.role === 'user' ? (
              <div
                key={message.id}
                className="max-w-[85%] self-end whitespace-pre-wrap rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--ink)]"
              >
                {message.text}
              </div>
            ) : (
              <div
                key={message.id}
                className="flex max-w-[92%] flex-col gap-2 self-start rounded-xl border border-[var(--line)] bg-[var(--surface-tint)] px-3 py-2 text-sm"
              >
                {renderAssistantBody(message)}
              </div>
            ),
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            placeholder="Например: как в проекте устроена RAG-индексация? или /help"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void send()} disabled={answer.isPending}>
              {answer.isPending ? 'Отвечаю…' : 'Отправить'}
            </Button>
            <span className="demo-muted text-xs">
              Enter — отправить, Shift+Enter — новая строка, /help — справка
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
