import { describe, expect, it, vi } from 'vitest'
import type { CallLLM, Tool } from '@lib/agent-loop/types'
import type { InvariantRecord } from '@lib/invariants/types'
import type { TaskAnalysis } from '@lib/task-state/state'
import type { TaskState } from '@lib/task-state/types'
import {
  looksLikeDocSyncGoal,
  looksLikeFileTask,
  looksLikeInvariantCheckGoal,
  looksLikeRepoStateGoal,
  looksLikeWriteGoal,
} from '../domain/file-router'
import { resolvePlanReply } from '../domain/file-reply'
import { runFileActionChecks } from '../domain/file-invariants'
import { extractPlanPaths } from '../domain/file-paths'
import { touchedPaths } from '../server/file-run.server'
import {
  approveFileTask,
  runFileGoal,
  type FileTaskStore,
} from '../server/file-task.server'

function scriptedLLM(
  decides: string[],
  finalize = 'Готово.',
  captured?: string[],
) {
  let index = 0
  const callLLM: CallLLM = async ({ messages, response_format }) => {
    if (captured) {
      captured.push(messages.map((message) => message.content).join('\n'))
    }
    const content = response_format
      ? (decides[Math.min(index, decides.length - 1)] ??
        '{"tool":null,"args":{}}')
      : finalize
    if (response_format) {
      index += 1
    }
    return {
      content,
      usage: { prompt_tokens: 1, completion_tokens: 1 },
      latencyMs: 0,
    }
  }
  return callLLM
}

const STOP = '{"tool":null,"args":{}}'

function planWrite(path: string, content: string): string {
  return JSON.stringify({
    tool: 'mcp_write_file',
    args: { path, content },
  })
}

function planRead(path: string): string {
  return JSON.stringify({ tool: 'mcp_read_file', args: { path } })
}

type Call = { tool: string; args: Record<string, unknown> }

function toolbox(calls: Call[]) {
  return async () => ({ tools: fakeTools(calls), close: async () => {} })
}

function fakeTools(calls: Call[]): Tool[] {
  const make = (name: string, mutating: boolean, text: string): Tool => ({
    name,
    description: name,
    argsExample: '{}',
    mutating,
    run: async (args) => {
      calls.push({ tool: name, args: args as Record<string, unknown> })
      return { ok: true, text, reference: null }
    },
  })
  return [
    make('mcp_list_files', false, 'src/'),
    make('mcp_read_file', false, '1: line'),
    make('mcp_search_text', false, 'src/core.server.ts:1: answerAboutProject'),
    make('mcp_git_status', false, 'чисто'),
    make('mcp_write_file', true, 'Файл записан.'),
    make('mcp_edit_file', true, 'Файл изменён.'),
  ]
}

const INVARIANTS: InvariantRecord[] = [
  {
    id: 1,
    token: 'file-assistant',
    slug: 'plan-paths-only',
    category: 'decision',
    title: 'Только файлы из утверждённого плана',
    text: 'Писать только файлы из плана.',
    check: 'plan-paths-only',
    pinned: true,
  },
]

function memoryStore(): FileTaskStore & {
  tasks: Map<number, TaskState>
  runs: Array<{ diff: string | null; answer: string; mode: string }>
} {
  const tasks = new Map<number, TaskState>()
  const runs: Array<{ diff: string | null; answer: string; mode: string }> = []
  let nextId = 1
  return {
    tasks,
    runs,
    async createTask(state) {
      const id = nextId
      nextId += 1
      tasks.set(id, state)
      return id
    },
    async getTask(id) {
      return tasks.get(id) ?? null
    },
    async saveTask(id, state) {
      tasks.set(id, state)
    },
    async saveRun(input) {
      runs.push({ diff: input.diff, answer: input.answer, mode: input.mode })
      return runs.length
    },
    async listInvariants() {
      return INVARIANTS
    },
  }
}

function analysis(overrides: Partial<TaskAnalysis> = {}): TaskAnalysis {
  return {
    title: 'Демо-док',
    stage: 'planning',
    step: 'Создать docs/file-assistant-demo.md',
    steps: [
      'Создать docs/file-assistant-demo.md',
      'Дописать раздел в src/features/dev-assistant/README.md',
    ],
    expectedAction: { actor: 'user', description: 'Утвердить план' },
    requiresTask: true,
    ...overrides,
  }
}

describe('роутер файлового режима', () => {
  it('отправляет вопросы о доках в RAG', () => {
    expect(looksLikeFileTask('Что делает RAG?')).toBe(false)
    expect(looksLikeFileTask('Расскажи про агента')).toBe(false)
  })

  it('узнаёт поиск и файловые операции', () => {
    expect(looksLikeFileTask('где используется answerAboutProject')).toBe(true)
    expect(looksLikeFileTask('создай docs/adr/0015.md')).toBe(true)
    expect(looksLikeFileTask('добавь раздел в README.md')).toBe(true)
  })

  it('узнаёт цели про diff и про инварианты', () => {
    expect(looksLikeRepoStateGoal('подготовь diff по изменённым файлам')).toBe(
      true,
    )
    expect(looksLikeRepoStateGoal('что изменилось в репозитории')).toBe(true)
    expect(looksLikeInvariantCheckGoal('проверь инварианты')).toBe(true)
    expect(
      looksLikeInvariantCheckGoal('проверь соответствие правилам проекта'),
    ).toBe(true)
    expect(looksLikeFileTask('подготовь diff по изменённым файлам')).toBe(true)
    expect(looksLikeFileTask('проверь соответствие правилам проекта')).toBe(
      true,
    )
  })

  it('отличает write-цель от детерминированных', () => {
    expect(
      looksLikeWriteGoal(
        'Обнови документацию по изменениям в коде: посмотри diff и приведи README в соответствие.',
      ),
    ).toBe(true)
    expect(looksLikeWriteGoal('Подготовь diff по изменённым файлам')).toBe(
      false,
    )
    expect(looksLikeWriteGoal('Проверь соответствие правилам проекта')).toBe(
      false,
    )
  })

  it('узнаёт синхронизацию документации', () => {
    expect(
      looksLikeDocSyncGoal('Обнови документацию по изменениям в коде'),
    ).toBe(true)
    expect(looksLikeDocSyncGoal('обнови readme')).toBe(true)
    expect(looksLikeDocSyncGoal('Создай демо-док')).toBe(false)
    expect(looksLikeDocSyncGoal('где используется answerAboutProject')).toBe(
      false,
    )
  })
})

describe('ответ на показанный план', () => {
  it('распознаёт текстовое подтверждение', () => {
    expect(resolvePlanReply('подтверждаю')).toBe('approve')
    expect(resolvePlanReply('делаем')).toBe('approve')
    expect(resolvePlanReply('да, всё верно')).toBe('approve')
    expect(resolvePlanReply('ок, приступай')).toBe('approve')
  })

  it('распознаёт отказ', () => {
    expect(resolvePlanReply('отмена')).toBe('cancel')
    expect(resolvePlanReply('нет')).toBe('cancel')
    expect(resolvePlanReply('не надо, отмени')).toBe('cancel')
  })

  it('считает новую файловую цель новой задачей', () => {
    expect(resolvePlanReply('создай demo.md в корне')).toBe('new-goal')
    expect(resolvePlanReply('нет, я передумал, создай demo.md в корне')).toBe(
      'new-goal',
    )
    expect(resolvePlanReply('а что такое RAG?')).toBe('new-goal')
  })
})

describe('детерминированные цели без LLM', () => {
  it('собирает diff изменённых файлов', async () => {
    const store = memoryStore()
    const outcome = await runFileGoal({
      goal: 'Подготовь diff по изменённым файлам',
      generator: 'cloud',
      deps: {
        store,
        repoChanges: async () => ({
          changedFiles: [{ status: 'M', path: 'src/a.ts' }],
          diff: 'diff --git a/src/a.ts b/src/a.ts',
        }),
      },
    })

    expect(outcome.kind).toBe('read')
    if (outcome.kind !== 'read') {
      return
    }
    expect(outcome.answer).toContain('src/a.ts')
    expect(outcome.diff).toContain('diff --git')
    expect(outcome.trace).toEqual([])
    expect(store.runs[0].mode).toBe('read')
    expect(store.runs[0].diff).toContain('diff --git')
  })

  it('возвращает отчёт по инвариантам', async () => {
    const store = memoryStore()
    const outcome = await runFileGoal({
      goal: 'Проверь соответствие правилам проекта',
      generator: 'cloud',
      deps: {
        store,
        invariantReport: async () =>
          'Нарушений нет: проверено изменённых файлов — 1, правила — INV-1.',
      },
    })

    expect(outcome.kind).toBe('read')
    if (outcome.kind !== 'read') {
      return
    }
    expect(outcome.answer).toContain('Нарушений нет')
    expect(outcome.trace).toEqual([])
    expect(store.runs[0].answer).toContain('Нарушений нет')
  })

  it('ведёт update-docs как write-цель, а не как repo-state', async () => {
    const store = memoryStore()
    const outcome = await runFileGoal({
      goal: 'Обнови документацию по изменениям в коде: посмотри diff и приведи README в соответствие.',
      generator: 'cloud',
      deps: {
        store,
        analyze: async () => analysis(),
        repoChanges: async () => {
          throw new Error('repo-state не должен вызываться для write-цели')
        },
      },
    })

    expect(outcome.kind).toBe('plan')
    expect(store.runs.length).toBe(0)
  })
})

describe('чтение без Задачи', () => {
  it('ищет через read-only инструменты и не создаёт Задачу', async () => {
    const calls: Call[] = []
    const store = memoryStore()
    const outcome = await runFileGoal({
      goal: 'Найди использования answerAboutProject',
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        analyze: async () => analysis({ requiresTask: false }),
        store,
        contextBlock: async () => null,
        diff: async () => '',
        llm: () =>
          scriptedLLM(
            [
              JSON.stringify({
                tool: 'mcp_search_text',
                args: { query: 'answerAboutProject' },
              }),
              '{"tool":null,"args":{}}',
            ],
            'Нашёл: src/core.server.ts:1',
          ),
      },
    })

    expect(outcome.kind).toBe('read')
    expect(calls.map((call) => call.tool)).toEqual(['mcp_search_text'])
    expect(store.tasks.size).toBe(0)
    if (outcome.kind === 'read') {
      expect(outcome.answer).toContain('src/core.server.ts:1')
      expect(store.runs[0].mode).toBe('read')
    }
  })
})

describe('мутация через план и approve', () => {
  const PLANNED = [
    'docs/file-assistant-demo.md',
    'src/features/dev-assistant/README.md',
  ]

  it('создаёт план, затем исполняет, проверяет и печатает diff', async () => {
    const calls: Call[] = []
    const store = memoryStore()
    const diff = vi.fn(async () => 'git diff: …')

    const plan = await runFileGoal({
      goal: 'Создай демо-док',
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        analyze: async () => analysis(),
        store,
        contextBlock: async () => null,
        diff,
        llm: () => scriptedLLM([]),
      },
    })
    expect(plan.kind).toBe('plan')
    if (plan.kind !== 'plan') {
      return
    }
    expect(plan.state.stage).toBe('planning')

    const done = await approveFileTask({
      taskId: plan.taskId,
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        store,
        contextBlock: async () => null,
        diff,
        llm: () =>
          scriptedLLM(
            [
              planWrite(PLANNED[0], 'demo'),
              STOP,
              planWrite(PLANNED[1], 'readme'),
              STOP,
              planRead(PLANNED[0]),
              STOP,
            ],
            'Изменения внесены.',
          ),
      },
    })

    expect(done.kind).toBe('done')
    if (done.kind !== 'done') {
      return
    }
    expect(done.retried).toBe(false)
    expect(done.touched).toEqual(PLANNED)
    expect(done.state.stage).toBe('done')
    expect(diff).toHaveBeenCalledWith(done.touched)
    expect(done.answer).toContain('Проверка')
    expect(store.runs.at(-1)?.diff).toBe('git diff: …')
  })

  it('исполняет каждый пункт плана отдельной фазой', async () => {
    const calls: Call[] = []
    const prompts: string[] = []
    const store = memoryStore()
    const plan = await runFileGoal({
      goal: 'Создай демо-док',
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        analyze: async () => analysis(),
        store,
        contextBlock: async () => null,
        diff: async () => '',
        llm: () => scriptedLLM([]),
      },
    })
    if (plan.kind !== 'plan') {
      throw new Error('ожидался план')
    }

    const done = await approveFileTask({
      taskId: plan.taskId,
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        store,
        contextBlock: async () => null,
        diff: async () => '',
        llm: () =>
          scriptedLLM(
            [
              planWrite(PLANNED[0], 'demo'),
              STOP,
              planWrite(PLANNED[1], 'readme'),
              STOP,
              planRead(PLANNED[1]),
              STOP,
            ],
            'Готово.',
            prompts,
          ),
      },
    })

    expect(done.kind).toBe('done')
    if (done.kind !== 'done') {
      return
    }
    expect(done.touched).toEqual(PLANNED)
    expect(done.retried).toBe(false)
    expect(
      prompts.some(
        (prompt) => prompt.includes('2/2') && prompt.includes(PLANNED[1]),
      ),
    ).toBe(true)
  })

  it('передаёт итог прошлых пунктов в следующие фазы', async () => {
    const calls: Call[] = []
    const prompts: string[] = []
    const store = memoryStore()
    const plan = await runFileGoal({
      goal: 'Создай демо-док',
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        analyze: async () => analysis(),
        store,
        contextBlock: async () => null,
        diff: async () => '',
        llm: () => scriptedLLM([]),
      },
    })
    if (plan.kind !== 'plan') {
      throw new Error('ожидался план')
    }

    const done = await approveFileTask({
      taskId: plan.taskId,
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        store,
        contextBlock: async () => null,
        diff: async () => '',
        llm: () =>
          scriptedLLM(
            [
              planWrite(PLANNED[0], 'demo'),
              STOP,
              planWrite(PLANNED[1], 'readme'),
              STOP,
              planRead(PLANNED[1]),
              STOP,
            ],
            'Записал файл.',
            prompts,
          ),
      },
    })

    expect(done.kind).toBe('done')
    if (done.kind !== 'done') {
      return
    }
    expect(done.touched).toEqual(PLANNED)
    expect(
      prompts.some(
        (prompt) =>
          prompt.includes('предыдущих пунктах') &&
          prompt.includes('Записал файл.'),
      ),
    ).toBe(true)
  })

  it('повторяет только незакрытые пункты плана', async () => {
    const calls: Call[] = []
    const store = memoryStore()
    const plan = await runFileGoal({
      goal: 'Создай демо-док',
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        analyze: async () => analysis(),
        store,
        contextBlock: async () => null,
        diff: async () => '',
        llm: () => scriptedLLM([]),
      },
    })
    if (plan.kind !== 'plan') {
      throw new Error('ожидался план')
    }

    const done = await approveFileTask({
      taskId: plan.taskId,
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        store,
        contextBlock: async () => null,
        diff: async () => '',
        llm: () =>
          scriptedLLM(
            [
              planWrite(PLANNED[0], 'demo'),
              STOP,
              STOP,
              STOP,
              planRead(PLANNED[0]),
              STOP,
              planWrite(PLANNED[1], 'readme'),
              STOP,
              planRead(PLANNED[1]),
              STOP,
            ],
            'Готово.',
          ),
      },
    })

    expect(done.kind).toBe('done')
    if (done.kind !== 'done') {
      return
    }
    expect(done.retried).toBe(true)
    expect(done.touched).toEqual(PLANNED)
  })

  it('эскалирует незакрытый пункт и честно помечает его', async () => {
    const calls: Call[] = []
    const prompts: string[] = []
    const store = memoryStore()
    const plan = await runFileGoal({
      goal: 'Создай демо-док',
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        analyze: async () => analysis(),
        store,
        contextBlock: async () => null,
        diff: async () => '',
        llm: () => scriptedLLM([]),
      },
    })
    if (plan.kind !== 'plan') {
      throw new Error('ожидался план')
    }

    const done = await approveFileTask({
      taskId: plan.taskId,
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        store,
        contextBlock: async () => null,
        diff: async () => '',
        llm: () =>
          scriptedLLM(
            [
              planWrite(PLANNED[0], 'demo'),
              STOP,
              planRead(PLANNED[1]),
              STOP,
              planRead(PLANNED[0]),
              STOP,
              planRead(PLANNED[1]),
              STOP,
              planRead(PLANNED[0]),
              STOP,
            ],
            'Готово.',
            prompts,
          ),
      },
    })

    expect(done.kind).toBe('done')
    if (done.kind !== 'done') {
      return
    }
    expect(done.touched).toEqual([PLANNED[0]])
    expect(done.unfinished).toHaveLength(1)
    expect(done.unfinished[0]).toContain('README.md')
    expect(done.answer).toContain('Не выполнено')
    expect(prompts.some((prompt) => prompt.includes('не выполнен'))).toBe(true)
  })

  it('сообщает, что файлы не изменены, когда в плане нет путей', async () => {
    const calls: Call[] = []
    const prompts: string[] = []
    const store = memoryStore()
    const plan = await runFileGoal({
      goal: 'Обнови документацию по изменениям в коде',
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        analyze: async () =>
          analysis({
            title: 'Обновить документацию',
            step: 'Найти документы по изменениям',
            steps: [
              'Определить изменённые файлы',
              'Найти документы по изменениям',
              'Обновить документы',
            ],
          }),
        store,
        contextBlock: async () => null,
        docDigest: async () => null,
        diff: async () => '',
        llm: () => scriptedLLM([]),
      },
    })
    if (plan.kind !== 'plan') {
      throw new Error('ожидался план')
    }

    const done = await approveFileTask({
      taskId: plan.taskId,
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        store,
        contextBlock: async () => null,
        docDigest: async () => null,
        diff: async () => '',
        llm: () =>
          scriptedLLM(
            [
              planRead(PLANNED[0]),
              STOP,
              planRead(PLANNED[0]),
              STOP,
              planRead(PLANNED[0]),
              STOP,
              planRead(PLANNED[0]),
              STOP,
              planRead(PLANNED[0]),
              STOP,
              planRead(PLANNED[0]),
              STOP,
            ],
            'Готово.',
            prompts,
          ),
      },
    })

    expect(done.kind).toBe('done')
    if (done.kind !== 'done') {
      return
    }
    expect(done.touched).toEqual([])
    expect(done.unfinished).toEqual([])
    expect(done.notChanged).toBe(true)
    expect(done.answer).toContain('Файлы не изменены')
    expect(prompts.some((prompt) => prompt.includes('ни один файл'))).toBe(true)
  })

  it('блокирует запись вне утверждённого плана', async () => {
    const calls: Call[] = []
    const store = memoryStore()
    const plan = await runFileGoal({
      goal: 'Создай демо-док',
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        analyze: async () => analysis(),
        store,
        contextBlock: async () => null,
        diff: async () => '',
        llm: () => scriptedLLM([]),
      },
    })
    if (plan.kind !== 'plan') {
      throw new Error('ожидался план')
    }

    const done = await approveFileTask({
      taskId: plan.taskId,
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        store,
        contextBlock: async () => null,
        diff: async () => '',
        llm: () =>
          scriptedLLM([planWrite('src/hack.ts', 'nope'), STOP], 'Готово.'),
      },
    })

    expect(calls.some((call) => call.tool === 'mcp_write_file')).toBe(false)
    if (done.kind === 'done') {
      expect(done.answer).toContain('правило нарушено')
    }
  })

  it('передаёт дайджест изменений в анализатор и в исполнение', async () => {
    const calls: Call[] = []
    const prompts: string[] = []
    const analyzed: Array<string | null> = []
    const store = memoryStore()
    const digest = {
      block:
        'ИЗМЕНЕНИЯ В КОДЕ (для синхронизации документации):\n- Документы, которые упоминают эти файлы: src/features/dev-assistant/README.md',
      docs: ['src/features/dev-assistant/README.md'],
    }
    const plan = await runFileGoal({
      goal: 'Обнови документацию по изменениям в коде',
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        analyze: async ({ context }) => {
          analyzed.push(context ?? null)
          return analysis({
            title: 'Обновить документацию',
            step: 'Дописать раздел в src/features/dev-assistant/README.md',
            steps: ['Дописать раздел в src/features/dev-assistant/README.md'],
          })
        },
        store,
        contextBlock: async () => null,
        docDigest: async () => digest,
        diff: async () => '',
        llm: () => scriptedLLM([]),
      },
    })
    if (plan.kind !== 'plan') {
      throw new Error('ожидался план')
    }
    expect(analyzed[0]).toContain('ИЗМЕНЕНИЯ В КОДЕ')

    const done = await approveFileTask({
      taskId: plan.taskId,
      generator: 'cloud',
      deps: {
        loadTools: toolbox(calls),
        store,
        contextBlock: async () => null,
        docDigest: async () => digest,
        diff: async () => 'git diff: …',
        llm: () =>
          scriptedLLM(
            [
              planWrite('src/features/dev-assistant/README.md', 'readme'),
              STOP,
              planRead('src/features/dev-assistant/README.md'),
              STOP,
            ],
            'Готово.',
            prompts,
          ),
      },
    })

    expect(done.kind).toBe('done')
    if (done.kind !== 'done') {
      return
    }
    expect(done.touched).toEqual(['src/features/dev-assistant/README.md'])
    expect(done.unfinished).toEqual([])
    expect(prompts.some((prompt) => prompt.includes('ИЗМЕНЕНИЯ В КОДЕ'))).toBe(
      true,
    )
  })
})

describe('разбор плана и тронутых путей', () => {
  it('извлекает пути из шагов плана', () => {
    const state = {
      title: 'Демо',
      stage: 'planning' as const,
      previousStage: null,
      approved: false,
      step: 'Создать docs/file-assistant-demo.md',
      steps: [
        'Создать docs/file-assistant-demo.md',
        'Дописать раздел в src/features/dev-assistant/README.md',
      ],
      stepIndex: 0,
      expectedAction: { actor: 'user' as const, description: 'ok' },
      updatedAt: '',
      history: [],
    }
    expect(extractPlanPaths(state)).toEqual([
      'docs/file-assistant-demo.md',
      'src/features/dev-assistant/README.md',
    ])
  })

  it('берёт тронутые пути только из успешных мутаций', () => {
    const trace = [
      {
        stage: 'act' as const,
        tool: 'mcp_write_file',
        args: { path: 'a.md' },
        outcome: { ok: true, text: 'ok', reference: null },
        mutating: true,
      },
      {
        stage: 'act' as const,
        tool: 'mcp_read_file',
        args: { path: 'b.md' },
        outcome: { ok: true, text: 'ok', reference: null },
        mutating: false,
      },
    ]
    expect(touchedPaths(trace)).toEqual(['a.md'])
  })
})

describe('правила файлового ассистента', () => {
  const records = [
    { ...INVARIANTS[0] },
    {
      ...INVARIANTS[0],
      id: 2,
      slug: 'no-secrets-in-files',
      check: 'no-secrets-in-files',
    },
    {
      ...INVARIANTS[0],
      id: 3,
      slug: 'protected-paths',
      check: 'protected-paths',
    },
  ]

  it('пропускает запись в файл из плана', () => {
    const result = runFileActionChecks(
      records,
      { tool: 'mcp_write_file', args: { path: 'docs/demo.md', content: 'ok' } },
      { planPaths: ['docs/demo.md'] },
    )
    expect(result.ok).toBe(true)
  })

  it('ловит запись мимо плана', () => {
    const result = runFileActionChecks(
      records,
      {
        tool: 'mcp_edit_file',
        args: { path: 'src/x.ts', oldString: 'a', newString: 'b' },
      },
      { planPaths: ['docs/demo.md'] },
    )
    expect(result.hits).toContain('INV-1')
  })

  it('ловит секреты в содержимом', () => {
    const result = runFileActionChecks(
      records,
      {
        tool: 'mcp_write_file',
        args: {
          path: 'docs/demo.md',
          content: 'DEEPSEEK_API_KEY=sk-1234567890abcdef',
        },
      },
      { planPaths: [] },
    )
    expect(result.hits).toContain('INV-2')
  })

  it('ловит защищённые пути', () => {
    const result = runFileActionChecks(
      records,
      {
        tool: 'mcp_write_file',
        args: { path: '.github/workflows/x.yml', content: 'a' },
      },
      { planPaths: [] },
    )
    expect(result.hits).toContain('INV-3')
  })
})
