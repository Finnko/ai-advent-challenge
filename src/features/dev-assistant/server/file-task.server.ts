import type { CallLLM, LoopTraceStep } from '@lib/agent-loop/types'
import type { InvariantRecord } from '@lib/invariants/types'
import {
  approveTask,
  createTaskState,
  transitionTask,
} from '@lib/task-state/state'
import type { TaskAnalysis } from '@lib/task-state/state'
import type { TaskState } from '@lib/task-state/types'
import type { AnswerGenerator } from '@lib/rag-engine.types'
import { createFileAnalyzer } from '../domain/file-analyzer'
import { extractPlanPaths } from '../domain/file-paths'
import type { FileOutcome } from '../domain/file-outcome'
import {
  looksLikeDocSyncGoal,
  looksLikeFileTask,
  looksLikeInvariantCheckGoal,
  looksLikeRepoStateGoal,
  looksLikeWriteGoal,
} from '../domain/file-router'
import { collectTouchedDiff } from './file-diff.server'
import { collectDocDigest, type DocDigest } from './doc-digest.server'
import { resolveFileAssistantLlm } from './file-llm.server'
import { createFileRun } from './file-run.server'
import { collectInvariantReport } from './repo-check.server'
import {
  collectRepoChanges,
  formatRepoChanges,
  type RepoChanges,
} from './repo-diff.server'
import {
  createFileTask,
  getFileTask,
  listFileInvariants,
  saveFileRun,
  saveFileTask,
  type FileRunMode,
} from './file-runs.server'
import { collectGitContext } from './git-context.server'
import {
  openDevAssistantTools,
  type DevAssistantToolbox,
} from './mcp-tools.server'

export type { FileTaskPhase } from './file-run.server'

export type FileTaskStore = {
  createTask(state: TaskState): Promise<number>
  getTask(id: number): Promise<TaskState | null>
  saveTask(id: number, state: TaskState): Promise<void>
  saveRun(input: {
    taskId: number | null
    goal: string
    mode: FileRunMode
    scenario: string | null
    plan: TaskState | null
    trace: LoopTraceStep[]
    diff: string | null
    answer: string
    model: string | null
  }): Promise<number>
  listInvariants(): Promise<InvariantRecord[]>
}

const fileRunStore: FileTaskStore = {
  createTask: createFileTask,
  getTask: getFileTask,
  saveTask: saveFileTask,
  saveRun: saveFileRun,
  listInvariants: listFileInvariants,
}

export type FileTaskDeps = {
  loadTools: () => Promise<DevAssistantToolbox>
  llm: (generator: AnswerGenerator) => CallLLM
  analyze: (input: {
    goal: string
    current: TaskState | null
    callLLM: CallLLM
    context?: string | null
  }) => Promise<TaskAnalysis | null>
  store: FileTaskStore
  contextBlock: () => Promise<string | null>
  docDigest: () => Promise<DocDigest | null>
  diff: (paths: string[]) => Promise<string>
  repoChanges: (maxLines?: number) => Promise<RepoChanges>
  invariantReport: () => Promise<string>
  today: () => string
}

export type FileTaskOutcome = { kind: 'docs' } | FileOutcome

function defaultDeps(): FileTaskDeps {
  return {
    loadTools: openDevAssistantTools,
    llm: resolveFileAssistantLlm,
    analyze: async ({ goal, current, callLLM, context }) => {
      const analyzer = createFileAnalyzer(callLLM, context ?? null)
      const result = await analyzer({
        current,
        history: [],
        userMessage: goal,
      })
      return result.analysis
    },
    store: fileRunStore,
    contextBlock: async () => (await collectGitContext()).block,
    docDigest: async () => {
      try {
        return await collectDocDigest()
      } catch {
        return null
      }
    },
    diff: (paths) => collectTouchedDiff(paths),
    repoChanges: (maxLines) => collectRepoChanges(maxLines),
    invariantReport: async () =>
      collectInvariantReport(await fileRunStore.listInvariants()),
    today: () => new Date().toISOString().slice(0, 10),
  }
}

function resolveDeps(overrides?: Partial<FileTaskDeps>): FileTaskDeps {
  return { ...defaultDeps(), ...overrides }
}

function mergeBlocks(...blocks: Array<string | null>): string | null {
  const parts = blocks.filter((block): block is string =>
    Boolean(block && block.trim().length > 0),
  )
  return parts.length > 0 ? parts.join('\n\n') : null
}

function toDone(state: TaskState, at: string): TaskState {
  const validated = transitionTask(state, 'validation', {
    at,
    reason: 'Изменения выполнены — переходим к проверке.',
  })
  const withValidation =
    validated.status === 'applied' ? validated.state : state
  const done = transitionTask(withValidation, 'done', {
    at,
    reason: 'Результат проверен — задача завершена.',
  })
  return done.status === 'applied' ? done.state : withValidation
}

function composeAnswer(
  execution: string,
  validation: string,
  retried: boolean,
  unfinished: string[],
  notChanged: boolean,
): string {
  const check =
    validation.trim().length > 0
      ? validation.trim()
      : 'результат сверен чтением файлов.'
  return [
    execution.trim().length > 0 ? execution.trim() : 'Изменения выполнены.',
    '',
    `Проверка: ${check}`,
    ...(retried
      ? ['', 'Понадобилась одна повторная попытка исполнения плана.']
      : []),
    ...(unfinished.length > 0
      ? [
          '',
          `Не выполнено (${unfinished.length}): ${unfinished.join('; ')}. Файлы этих пунктов не изменены.`,
        ]
      : []),
    ...(notChanged
      ? ['', 'Файлы не изменены — ассистент не внёс правок.']
      : []),
  ].join('\n')
}

export async function runFileGoal(input: {
  goal: string
  generator: AnswerGenerator
  scenario?: string | null
  deps?: Partial<FileTaskDeps>
}): Promise<FileTaskOutcome> {
  const goal = input.goal.trim()
  if (goal.length === 0 || !looksLikeFileTask(goal)) {
    return { kind: 'docs' }
  }
  const deps = resolveDeps(input.deps)
  const writeGoal = looksLikeWriteGoal(goal)

  if (!writeGoal && looksLikeInvariantCheckGoal(goal)) {
    const answer = await deps.invariantReport()
    const runId = await deps.store.saveRun({
      taskId: null,
      goal,
      mode: 'read',
      scenario: input.scenario ?? null,
      plan: null,
      trace: [],
      diff: null,
      answer,
      model: null,
    })
    return { kind: 'read', answer, trace: [], model: null, runId }
  }

  if (!writeGoal && looksLikeRepoStateGoal(goal)) {
    const changes = await deps.repoChanges()
    const answer = formatRepoChanges(changes)
    const runId = await deps.store.saveRun({
      taskId: null,
      goal,
      mode: 'read',
      scenario: input.scenario ?? null,
      plan: null,
      trace: [],
      diff: changes.diff,
      answer,
      model: null,
    })
    return {
      kind: 'read',
      answer,
      trace: [],
      model: null,
      runId,
      diff: changes.diff,
    }
  }

  const callLLM = deps.llm(input.generator)
  const digest = looksLikeDocSyncGoal(goal) ? await deps.docDigest() : null
  const analysis = await deps.analyze({
    goal,
    current: null,
    callLLM,
    context: digest?.block ?? null,
  })
  const at = new Date().toISOString()

  if (analysis && analysis.requiresTask !== false) {
    const state = createTaskState(analysis, at)
    const taskId = await deps.store.createTask(state)
    return { kind: 'plan', taskId, state }
  }

  const toolbox = await deps.loadTools()
  try {
    const run = createFileRun({
      goal,
      tools: toolbox.tools,
      invariants: await deps.store.listInvariants(),
      planPaths: [],
      contextBlock: mergeBlocks(
        digest?.block ?? null,
        await deps.contextBlock(),
      ),
      callLLM,
      today: deps.today(),
      state: null,
    })
    const read = await run.phase('read')
    const runId = await deps.store.saveRun({
      taskId: null,
      goal,
      mode: 'read',
      scenario: input.scenario ?? null,
      plan: null,
      trace: read.trace,
      diff: null,
      answer: read.answer,
      model: null,
    })
    return {
      kind: 'read',
      answer: read.answer,
      trace: read.trace,
      model: null,
      runId,
    }
  } finally {
    await toolbox.close()
  }
}

export async function approveFileTask(input: {
  taskId: number
  generator: AnswerGenerator
  deps?: Partial<FileTaskDeps>
}): Promise<FileOutcome> {
  const deps = resolveDeps(input.deps)
  const stored = await deps.store.getTask(input.taskId)
  if (!stored) {
    throw new Error('Файловая задача не найдена')
  }
  const goal = stored.title
  const at = new Date().toISOString()
  const approved = approveTask(stored, at)
  const digest = looksLikeDocSyncGoal(goal) ? await deps.docDigest() : null
  const toolbox = await deps.loadTools()
  try {
    const run = createFileRun({
      goal,
      tools: toolbox.tools,
      invariants: await deps.store.listInvariants(),
      planPaths: extractPlanPaths(approved),
      contextBlock: mergeBlocks(
        digest?.block ?? null,
        await deps.contextBlock(),
      ),
      callLLM: deps.llm(input.generator),
      today: deps.today(),
      state: approved,
    })
    const plan = await run.runPlan()
    const diff = await deps.diff(plan.touched)
    const finalState = toDone(approved, at)
    await deps.store.saveTask(input.taskId, finalState)
    const executionAnswer = plan.executions
      .map((run) => run.answer.trim())
      .filter((text) => text.length > 0)
      .join('\n\n')
    const answer = composeAnswer(
      executionAnswer,
      plan.validation.answer,
      plan.retried,
      plan.unfinished,
      plan.notChanged,
    )
    const runId = await deps.store.saveRun({
      taskId: input.taskId,
      goal,
      mode: 'write',
      scenario: null,
      plan: finalState,
      trace: plan.trace,
      diff,
      answer,
      model: null,
    })
    return {
      kind: 'done',
      taskId: input.taskId,
      answer,
      trace: plan.trace,
      diff,
      touched: plan.touched,
      unfinished: plan.unfinished,
      notChanged: plan.notChanged,
      state: finalState,
      model: null,
      retried: plan.retried,
      runId,
    }
  } finally {
    await toolbox.close()
  }
}
