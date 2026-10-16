import { useState } from 'react'
import { useAssistantAnswer } from '../api/use-assistant-answer'
import { useApproveFileTask, useStartFileTask } from '../api/use-file-task'
import { FILE_SCENARIOS } from '../data/file-scenarios'
import { helpText, parseInput } from '../data/help'
import { resolvePlanReply } from '../domain/file-reply'
import type { AnswerGenerator, DevAssistantAnswer, FileOutcome } from '../types'
import AnswerSources from './AnswerSources'
import FileOutcomeView from './FileOutcomeView'
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
      file?: FileOutcome
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

function renderAssistantBody(
  message: AssistantMessage,
  busy: boolean,
  actions: { onApprove: () => void; onCancel: () => void },
) {
  if (message.pending) {
    return <span className="demo-muted">Думаю…</span>
  }
  if (message.error) {
    return <Alert variant="destructive">{message.error}</Alert>
  }
  return (
    <>
      {message.text.length > 0 && (
        <p className="m-0 whitespace-pre-wrap leading-relaxed text-[var(--ink)]">
          {message.text}
        </p>
      )}
      {message.result && <AnswerSources result={message.result} />}
      {message.file && (
        <FileOutcomeView
          outcome={message.file}
          busy={busy}
          onApprove={actions.onApprove}
          onCancel={actions.onCancel}
        />
      )}
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
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [pendingPlan, setPendingPlan] = useState<AssistantMessage | null>(null)
  const answer = useAssistantAnswer()
  const fileTask = useStartFileTask()
  const approve = useApproveFileTask()

  const busy = answer.isPending || fileTask.isPending || approve.isPending

  const push = (message: ChatMessage) =>
    setMessages((prev) => [...prev, message])

  const replaceMessage = (id: string, message: ChatMessage) =>
    setMessages((prev) =>
      prev.map((item) => (item.id === id ? message : item)),
    )

  const approveMessage = async (message: AssistantMessage) => {
    if (!message.file || message.file.kind !== 'plan') {
      return
    }
    const taskId = message.file.taskId
    setPendingPlan(null)
    setApprovingId(message.id)
    try {
      const outcome = await approve.mutateAsync({ taskId, generator })
      replaceMessage(message.id, {
        id: message.id,
        role: 'assistant',
        text: '',
        file: outcome,
      })
    } catch (cause) {
      replaceMessage(message.id, {
        id: message.id,
        role: 'assistant',
        text: '',
        error: cause instanceof Error ? cause.message : String(cause),
      })
    } finally {
      setApprovingId(null)
    }
  }

  const cancelMessage = (
    message: AssistantMessage,
    text = 'План отклонён — файлы не изменялись.',
  ) => {
    setPendingPlan(null)
    replaceMessage(message.id, {
      id: message.id,
      role: 'assistant',
      text,
    })
  }

  const send = async (raw: string) => {
    const parsed = parseInput(raw)
    if (parsed.kind === 'empty') {
      return
    }
    setDraft('')

    if (parsed.kind === 'help') {
      push({ id: nextId('u'), role: 'user', text: raw.trim() })
      push({ id: nextId('a'), role: 'assistant', text: helpText() })
      return
    }

    if (pendingPlan) {
      const reply = resolvePlanReply(parsed.question)
      if (reply === 'cancel') {
        push({ id: nextId('u'), role: 'user', text: parsed.question })
        cancelMessage(pendingPlan)
        return
      }
      if (reply === 'approve') {
        push({ id: nextId('u'), role: 'user', text: parsed.question })
        await approveMessage(pendingPlan)
        return
      }
      cancelMessage(
        pendingPlan,
        'План заменён новым запросом — файлы не изменялись.',
      )
    }

    const pendingId = nextId('a')
    push({ id: nextId('u'), role: 'user', text: parsed.question })
    push({ id: pendingId, role: 'assistant', text: '', pending: true })

    const replace = (message: ChatMessage) => replaceMessage(pendingId, message)

    try {
      const outcome = await fileTask.mutateAsync({
        goal: parsed.question,
        generator,
      })
      if (outcome.kind === 'docs') {
        replace({
          id: pendingId,
          role: 'assistant',
          text: outcome.answer.answer,
          result: outcome.answer,
        })
        onAnswer?.(outcome.answer)
        return
      }
      const message: AssistantMessage = {
        id: pendingId,
        role: 'assistant',
        text: '',
        file: outcome,
      }
      replace(message)
      if (outcome.kind === 'plan') {
        setPendingPlan(message)
      }
    } catch (cause) {
      replace({
        id: pendingId,
        role: 'assistant',
        text: '',
        error: cause instanceof Error ? cause.message : String(cause),
      })
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
            <div className="flex flex-col gap-2">
              <p className="demo-muted m-0 text-sm">
                Спросите что-нибудь о проекте, попросите найти использования или
                изменить файлы. Справка —{' '}
                <span className="font-mono">/help</span>.
              </p>
              <div className="flex flex-wrap gap-2">
                {FILE_SCENARIOS.map((scenario) => (
                  <Button
                    key={scenario.id}
                    size="xs"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void send(scenario.goal)}
                  >
                    {scenario.title}
                  </Button>
                ))}
              </div>
            </div>
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
                {renderAssistantBody(message, approvingId === message.id, {
                  onApprove: () => void approveMessage(message),
                  onCancel: () => cancelMessage(message),
                })}
              </div>
            ),
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            placeholder="Например: где используется answerAboutProject? или создай docs/file-assistant-demo.md"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send(draft)
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void send(draft)} disabled={busy}>
              {busy ? 'Работаю…' : 'Отправить'}
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
