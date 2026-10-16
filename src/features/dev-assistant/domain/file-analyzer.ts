import type { CallLLM, LlmMessage } from '@lib/agent-loop/types'
import {
  createAnalyzer,
  type AnalyzeTaskState,
  type AnalyzeTaskStateInput,
} from '@lib/task-state/analyze'

const HISTORY_LIMIT = 6

const FILE_STAGE_TAXONOMY = [
  'Этапы файловой задачи (конечный автомат):',
  '- planning — предлагаем план изменений, ждём подтверждения пользователя.',
  '- execution — выполняем утверждённый план (создаём/изменяем файлы).',
  '- validation — сверяем результат чтением файлов.',
  '- done — задача завершена.',
  '- paused, cancelled — пауза и отмена.',
].join('\n')

const FILE_ANALYSIS_RULES = [
  'Правила:',
  '- "requiresTask": false, если запрос — это чтение или поиск: найти файл, найти использования, прочитать, показать структуру, ответить по документации. Такие запросы выполняются сразу, без плана и согласования.',
  '- "requiresTask": true, если запрос создаёт, изменяет или удаляет файлы проекта.',
  '- Если цель — обновить или синхронизировать документацию: сначала определи, что изменилось в коде (git_changed_files, git_diff), затем найди документы, которые описывают затронутые файлы и символы, и только потом предложи шаги с конкретными doc-файлами.',
  '- В каждом пункте плана указывай конкретный путь файла с расширением (например «Дописать раздел в src/features/dev-assistant/README.md»), а не «README и ADR» без путей: по этим путям проверяется выполнение плана.',
  '- Если ниже дан блок «ИЗМЕНЕНИЯ В КОДЕ», считай перечисленные документы уже найденными: в пунктах плана называй именно их, а не «найденные документы».',
  '- Если "requiresTask" = false, поля плана не важны — верни stage "planning".',
  '- Если "requiresTask" = true: stage = "planning", expectedAction.actor = "user" (ждём подтверждения), title — короткая цель.',
  '- В "steps" верни 1–6 конкретных пунктов плана с путями файлов (например «Создать docs/file-assistant-demo.md»); текущий пункт продублируй в "step".',
  '- Если состояние уже утверждено (approved = true) и stage = "execution" — верни stage "execution" и expectedAction.actor = "agent": выполняй план и не переспрашивай.',
  '- Не перескакивай этапы: planning → execution → validation → done.',
  '- "validation" — когда изменения уже сделаны и нужно сверить результат чтением; actor = "agent".',
  'Верни ТОЛЬКО JSON-объект вида {"title": "...", "requiresTask": true | false, "stage": "planning" | "execution" | "validation" | "done" | "paused" | "cancelled", "step": "...", "steps": ["..."], "expectedAction": {"actor": "user" | "agent", "description": "..."}, "reason": "..."}. Без текста до "{" и после "}".',
].join('\n')

export function buildFileAnalyzerMessages(
  input: AnalyzeTaskStateInput,
  context: string | null = null,
): LlmMessage[] {
  const current = input.current
    ? JSON.stringify(
        {
          title: input.current.title,
          stage: input.current.stage,
          approved: input.current.approved,
          step: input.current.step,
          steps: input.current.steps,
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
        'Ты ведёшь состояние файловой задачи ассистента, работающего с файлами проекта.',
        FILE_STAGE_TAXONOMY,
        FILE_ANALYSIS_RULES,
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
        ...(context ? [context, ''] : []),
        'Новая цель пользователя:',
        input.userMessage,
      ].join('\n'),
    },
  ]
}

export function createFileAnalyzer(
  callLLM: CallLLM,
  context: string | null = null,
): AnalyzeTaskState {
  return createAnalyzer({
    buildMessages: (input) => buildFileAnalyzerMessages(input, context),
    callLLM,
    temperature: 0.2,
    maxTokens: 500,
  })
}
