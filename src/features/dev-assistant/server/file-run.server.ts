import { runToolLoop } from '@lib/agent-loop/loop'
import { REF_INSTRUCTION_LINE, toolCatalogLines } from '@lib/agent-loop/prompt'
import { estimateTokens } from '@lib/agent-loop/tokens'
import type {
  BlockedInfo,
  CallLLM,
  LlmMessage,
  LoopRunResult,
  LoopTraceStep,
  Tool,
} from '@lib/agent-loop/types'
import { invariantCode, type InvariantRecord } from '@lib/invariants/types'
import { hasReadonlyVerification } from '@lib/task-state/advance'
import { formatTaskStateBlock } from '@lib/task-state/read'
import type { TaskState } from '@lib/task-state/types'
import {
  buildFileInvariantBlock,
  runFileActionChecks,
} from '../domain/file-invariants'
import { matchesPlannedPath, pathsInText } from '../domain/file-paths'
import {
  FILE_BASE_SYSTEM,
  FILE_DECIDE_SCOPE_LINES,
  FILE_FINALIZE_LINES,
  FILE_STAGE_NOTES,
  FILE_TOOL_HINTS,
  executionStepLine,
  toolKey,
} from '../domain/file-persona'

const MAX_ACTIONS = 16
const READ_MAX_TOKENS = 1500
const EXECUTION_MAX_TOKENS = 6000
const FINALIZE_MAX_TOKENS = 1200

export type FileTaskPhase = 'read' | 'execution' | 'validation'

export type FileRunInput = {
  goal: string
  tools: Tool[]
  invariants: InvariantRecord[]
  planPaths: string[]
  contextBlock: string | null
  callLLM: CallLLM
  today: string
  state: TaskState | null
}

export type FilePlanRun = {
  executions: LoopRunResult[]
  validation: LoopRunResult
  trace: LoopTraceStep[]
  touched: string[]
  retried: boolean
  unfinished: string[]
  notChanged: boolean
}

export type FileRun = {
  phase(
    name: FileTaskPhase,
    stepIndex?: number,
    note?: string | null,
    progress?: string[],
  ): Promise<LoopRunResult>
  runPlan(): Promise<FilePlanRun>
  touched(): string[]
}

export function readOnlyToolNames(tools: Tool[]): string[] {
  return tools.filter((tool) => !tool.mutating).map((tool) => tool.name)
}

function allowlistFor(phase: FileTaskPhase, tools: Tool[]): string[] {
  return phase === 'execution'
    ? tools.map((tool) => tool.name)
    : readOnlyToolNames(tools)
}

export function touchedPaths(trace: LoopTraceStep[]): string[] {
  const paths: string[] = []
  for (const step of trace) {
    if (step.stage !== 'act' || !step.outcome.ok || !step.mutating) {
      continue
    }
    const raw = (step.args as Record<string, unknown>).path
    if (typeof raw === 'string' && raw.trim().length > 0) {
      paths.push(raw.trim())
    }
  }
  return [...new Set(paths)]
}

function gateReason(phase: FileTaskPhase, tool: string): string {
  if (phase === 'read') {
    return `Инструмент ${tool} недоступен: сейчас режим поиска и чтения.`
  }
  return `Инструмент ${tool} недоступен на этапе проверки: изменяющие действия запрещены.`
}

function blockedFileAnswer(
  info: BlockedInfo,
  invariants: InvariantRecord[],
): { answer: string; reason: string | null } {
  const hits =
    info.actionHits.length > 0 ? info.actionHits : info.answerCheck.hits
  const records = invariants.filter((record) =>
    hits.includes(invariantCode(record)),
  )
  if (records.length === 0) {
    const text =
      info.actRefusal ?? 'Действие отклонено политикой файлового ассистента.'
    return { answer: text, reason: text }
  }
  const lines = records.map(
    (record) => `${invariantCode(record)} — ${record.text}`,
  )
  return {
    answer: `Действие отклонено, правило нарушено:\n${lines.join('\n')}`,
    reason: records.map((record) => record.text).join(' '),
  }
}

function untouchedPaths(step: string, touched: string[]): string[] {
  return pathsInText(step).filter((path) => !matchesPlannedPath(path, touched))
}

function missingStepIndexes(steps: string[], touched: string[]): number[] {
  const missing: number[] = []
  steps.forEach((step, index) => {
    if (untouchedPaths(step, touched).length > 0) {
      missing.push(index)
    }
  })
  return missing
}

function escalationNote(step: string, untouched: string[]): string {
  const files = untouched.map((path) => `«${path}»`).join(', ')
  return `Пункт «${step}» ещё не выполнен: файлы ${files} не изменены. Сейчас нужно вызвать write_file или edit_file и изменить их; если это невозможно — прямо объясни причину.`
}

const NOTHING_WRITTEN_NOTE =
  'Задача не выполнена: ни один файл ещё не изменён. Сейчас обязательно измени нужные файлы через write_file или edit_file; если изменение невозможно — прямо объясни причину.'

const PROGRESS_ANSWER_MAX = 600

function progressNote(lines: string[]): string | null {
  if (lines.length === 0) {
    return null
  }
  return `Что уже сделано на предыдущих пунктах плана (используй это, не повторяй работу):\n${lines.map((line) => `- ${line}`).join('\n')}`
}

export function createFileRun(input: FileRunInput): FileRun {
  const touched = new Set<string>()

  const stateFor = (
    phase: FileTaskPhase,
    stepIndex: number,
  ): TaskState | null => {
    if (phase === 'read' || !input.state) {
      return null
    }
    if (phase === 'validation') {
      return { ...input.state, stage: 'validation' }
    }
    const step = input.state.steps[stepIndex] ?? input.state.step
    return {
      ...input.state,
      stage: 'execution',
      step,
      stepIndex,
      expectedAction: { actor: 'agent', description: step },
    }
  }

  const runPhase = async (
    phase: FileTaskPhase,
    stepIndex: number,
    note: string | null,
    progress: string[],
  ): Promise<LoopRunResult> => {
    const allowedToolNames = allowlistFor(phase, input.tools)
    const allowed = input.tools.filter((tool) =>
      allowedToolNames.includes(tool.name),
    )
    const state = stateFor(phase, stepIndex)
    const baseSystem = `${FILE_BASE_SYSTEM} Сегодня: ${input.today}.`
    const invariantBlock = buildFileInvariantBlock(input.invariants)
    const taskBlock = state ? formatTaskStateBlock(state) : null
    const stageNote = state ? (FILE_STAGE_NOTES[state.stage] ?? null) : null
    const progressBlock = progressNote(progress)
    const stepLine =
      phase === 'execution' && state && state.steps.length > 0
        ? executionStepLine(stepIndex, state.steps.length, state.step)
        : null
    const maxTokens =
      phase === 'execution' ? EXECUTION_MAX_TOKENS : READ_MAX_TOKENS

    return runToolLoop({
      request: input.goal,
      model: 'file-assistant',
      callLLM: input.callLLM,
      toolContext: {},
      tools: input.tools,
      allowedToolNames,
      history: [],
      systemTokens: estimateTokens(baseSystem),
      contextTokens: 0,
      contextMessages: 0,
      budgetTokens: null,
      maxActions: MAX_ACTIONS,
      hooks: {
        prompts: {
          systemMessages: (): LlmMessage[] => [
            { role: 'system', content: baseSystem },
            ...(invariantBlock
              ? [{ role: 'system' as const, content: invariantBlock }]
              : []),
            ...(input.contextBlock
              ? [{ role: 'system' as const, content: input.contextBlock }]
              : []),
            ...(taskBlock
              ? [{ role: 'system' as const, content: taskBlock }]
              : []),
            ...(stageNote
              ? [{ role: 'system' as const, content: stageNote }]
              : []),
            ...(progressBlock
              ? [{ role: 'system' as const, content: progressBlock }]
              : []),
            ...(note ? [{ role: 'system' as const, content: note }] : []),
          ],
          decideUser: () =>
            [
              `Цель: ${input.goal}`,
              ...(stepLine ? [stepLine] : []),
              '',
              ...FILE_DECIDE_SCOPE_LINES,
              'Доступные инструменты:',
              ...toolCatalogLines(allowed),
              ...allowed.flatMap(
                (tool) => FILE_TOOL_HINTS[toolKey(tool.name)] ?? [],
              ),
              '',
              REF_INSTRUCTION_LINE,
            ].join('\n'),
          finalizeUser: (_state, report) =>
            [
              `Цель: ${input.goal}`,
              '',
              report,
              '',
              ...FILE_FINALIZE_LINES,
            ].join('\n'),
          decideParams: () => ({
            temperature: 0.2,
            response_format: { type: 'json_object' as const },
            max_tokens: maxTokens,
          }),
          finalizeParams: () => ({
            temperature: 0.3,
            max_tokens: FINALIZE_MAX_TOKENS,
          }),
        },
        policy: {
          gate: (_state, tool) =>
            allowedToolNames.includes(tool)
              ? { allow: true }
              : { allow: false, reason: gateReason(phase, tool) },
          nudge: (loopState) =>
            phase !== 'validation' && loopState.actions.length === 0
              ? 'Пункт ещё не выполнен. Вызови инструмент, который продвигает текущий пункт плана, или верни {"tool": null, "args": {}}.'
              : null,
          onRepeat: () =>
            'Этот же вызов повторяется без изменений и не продвигает пункт. Смени аргументы (например, startLine/maxLines) или инструмент; чтобы закрыть пункт, измени файл через write_file или edit_file.',
          checkAction: (_state, call) =>
            runFileActionChecks(input.invariants, call, {
              planPaths: input.planPaths,
            }),
          onBlocked: (_state, info) =>
            blockedFileAnswer(info, input.invariants),
        },
      },
    })
  }

  const phase = async (
    name: FileTaskPhase,
    stepIndex = 0,
    note: string | null = null,
    progress: string[] = [],
  ): Promise<LoopRunResult> => {
    const run = await runPhase(name, stepIndex, note, progress)
    for (const path of touchedPaths(run.trace)) {
      touched.add(path)
    }
    return run
  }

  return {
    phase,
    async runPlan() {
      const steps = input.state?.steps ?? []
      const plan = steps.length > 0 ? steps : [input.state?.step ?? input.goal]
      const executions: LoopRunResult[] = []
      const progress: string[] = []
      const runStep = async (
        index: number,
        note: string | null = null,
      ): Promise<LoopRunResult> => {
        const run = await phase('execution', index, note, [...progress])
        executions.push(run)
        const summary = run.answer.trim()
        if (summary.length > 0) {
          progress.push(
            `Пункт ${index + 1} «${plan[index] ?? ''}»: ${summary.slice(0, PROGRESS_ANSWER_MAX)}`,
          )
        }
        return run
      }
      for (let index = 0; index < plan.length; index += 1) {
        const run = await runStep(index)
        if (!run.ok) {
          break
        }
      }
      let validation = await phase('validation', 0, null, [...progress])
      let retried = false
      if (executions.every((run) => run.ok)) {
        const missing = missingStepIndexes(plan, [...touched])
        if (missing.length > 0) {
          retried = true
          for (const index of missing) {
            const step = plan[index] ?? ''
            const run = await runStep(
              index,
              escalationNote(step, untouchedPaths(step, [...touched])),
            )
            if (!run.ok) {
              break
            }
          }
          validation = await phase('validation', 0, null, [...progress])
        } else if (input.state !== null && touched.size === 0) {
          retried = true
          const index = plan.length - 1
          const run = await runStep(index, NOTHING_WRITTEN_NOTE)
          if (run.ok) {
            validation = await phase('validation', 0, null, [...progress])
          }
        } else if (!hasReadonlyVerification(validation)) {
          validation = await phase('validation', 0, null, [...progress])
        }
      }
      const untouched = missingStepIndexes(plan, [...touched])
      const unfinished = untouched.map((index) => plan[index] ?? '')
      const notChanged = input.state !== null && touched.size === 0
      const trace = [
        ...executions.flatMap((run) => run.trace),
        ...validation.trace,
      ]
      return {
        executions,
        validation,
        trace,
        touched: [...touched],
        retried,
        unfinished,
        notChanged,
      }
    },
    touched: () => [...touched],
  }
}
