import type { CallLLM, LlmMessage } from '../agent'
import type { SummaryUsage } from '../compression'
import type { TaskAnalysis } from './state'
import type { TaskState } from './types'
import { isTaskActor, isTaskStage } from './types'

export type AnalyzeTaskStateInput = {
  current: TaskState | null
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  userMessage: string
}

export type AnalyzeTaskStateResult = {
  analysis: TaskAnalysis | null
  usage: SummaryUsage | null
}

export type AnalyzeTaskState = (
  input: AnalyzeTaskStateInput,
) => Promise<AnalyzeTaskStateResult>

const HISTORY_LIMIT = 8

const STAGE_TAXONOMY = [
  'Этапы задачи (конечный автомат):',
  '- planning — выясняем и уточняем, что нужно пользователю; собираем параметры.',
  '- execution — агент выполняет действия (вызывает инструменты).',
  '- validation — подтверждаем результат и сверяем его с исходным запросом.',
  '- done — задача завершена.',
  '- paused — пользователь поставил задачу на паузу.',
  '- cancelled — задача отменена.',
].join('\n')

const ANALYSIS_RULES = [
  'Правила:',
  '- Определи этап, текущий шаг (кратко, что делаем сейчас) и ожидаемое действие.',
  '- Верни упорядоченный план шагов ТЕКУЩЕГО этапа в поле "steps" (от 1 до 6 пунктов); текущий шаг продублируй в "step".',
  '- Не объединяй независимые шаги в один и не перескакивай через шаги; при смене этапа задай новый план для нового этапа.',
  '- expectedAction.actor = "user", если следующий ход за пользователем; "agent" — если действовать должен агент.',
  '- Этап "planning" всегда означает, что агент только предлагает план и ждёт подтверждения: actor = "user". Уточнение параметров остаётся в "planning".',
  '- Переход "planning" → "execution" возможен только по явному согласию пользователя («да», «приступай», «всё верно», «окей делаем»), а не из-за того, что параметров достаточно.',
  '- Соблюдай порядок этапов planning → execution → validation → done, не перескакивай через этапы.',
  '- "validation" — когда действие уже выполнено и нужно сверить/подтвердить результат («проверь», «подтверди», «верно ли»); actor = "agent", шаг — проверка результата.',
  '- "done" — только когда пользователь явно подтверждает завершение («готово», «спасибо», «всё верно»); из "validation" это финальный переход.',
  '- Если пользователь во время "validation" говорит, что результат неверный или просит правки («неверно», «не то», «переделай», «исправь», «заново», «не получилось», «ошибка») — верни "execution", а не "done".',
  '- Пока пользователь сомневается или просит что-то изменить, не ставь "done".',
  '- Если пользователь просит паузу («пауза», «стоп», «подожди», «на потом») — stage должен быть "paused".',
  '- Если текущий этап "paused" и пользователь просит продолжить — верни этап, с которого стояли на паузе (поле previousStage), либо "planning", если он неизвестен.',
  '- Если задача завершена (done/cancelled) и пользователь начал новый несвязанный запрос — верни "planning" и новое title.',
  '- Сохраняй текущий title, пока задача та же; меняй только при новой задаче.',
  'Верни ТОЛЬКО JSON-объект вида {"title": "...", "stage": "planning" | "execution" | "validation" | "done" | "paused" | "cancelled", "step": "...", "steps": ["...", "..."], "expectedAction": {"actor": "user" | "agent", "description": "..."}, "reason": "..."}. Без текста до "{" и после "}".',
].join('\n')

export function buildTaskStateMessages(
  input: AnalyzeTaskStateInput,
): LlmMessage[] {
  const current = input.current
    ? JSON.stringify(
        {
          title: input.current.title,
          stage: input.current.stage,
          previousStage: input.current.previousStage,
          step: input.current.step,
          expectedAction: input.current.expectedAction,
        },
        null,
        2,
      )
    : 'нет (новой задачи ещё нет)'
  const history = input.history
    .slice(-HISTORY_LIMIT)
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n')
  return [
    {
      role: 'system',
      content: [
        'Ты ведёшь состояние задачи агента как конечный автомат.',
        STAGE_TAXONOMY,
        ANALYSIS_RULES,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        'Текущее состояние задачи (JSON):',
        current,
        '',
        'Недавняя история диалога:',
        history.length > 0 ? history : '(пусто)',
        '',
        'Новое сообщение пользователя:',
        input.userMessage,
      ].join('\n'),
    },
  ]
}

export function parseTaskAnalysis(content: string): TaskAnalysis | null {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') {
    return null
  }
  const record = parsed as Record<string, unknown>
  if (!isTaskStage(record.stage)) {
    return null
  }
  const expected =
    record.expectedAction && typeof record.expectedAction === 'object'
      ? (record.expectedAction as Record<string, unknown>)
      : {}
  const steps = Array.isArray(record.steps)
    ? record.steps
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : []
  return {
    title: typeof record.title === 'string' ? record.title : null,
    stage: record.stage,
    step: typeof record.step === 'string' ? record.step : '',
    steps: steps.length > 0 ? steps : undefined,
    expectedAction: {
      actor: isTaskActor(expected.actor) ? expected.actor : 'agent',
      description:
        typeof expected.description === 'string' ? expected.description : '',
    },
    reason: typeof record.reason === 'string' ? record.reason : null,
  }
}

export function createAnalyzeTaskState(callLLM: CallLLM): AnalyzeTaskState {
  return async (input) => {
    const reply = await callLLM({
      messages: buildTaskStateMessages(input),
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 400,
    })
    return {
      analysis: parseTaskAnalysis(reply.content),
      usage: reply.usage,
    }
  }
}
