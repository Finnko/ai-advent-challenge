import { cancelTask, transitionTask } from '@lib/task-state/state'
import type { TaskStage, TaskState } from '@lib/task-state/types'
import { ADVANCED_CRITERIA, CRITERIA } from '../data/criteria'
import { assembleResults } from '../domain/assemble'
import { runStaticChecks, type StaticCheckOutcome } from '../domain/code-checks'
import type { ModelVerdict } from '../domain/contract'
import type { SourceFile } from '../domain/sources'
import {
  scorePlaywright,
  unstartedPlaywrightResults,
  type BasicResult,
} from '../domain/playwright'
import type { CriterionResult, StageId, StageState } from '../types'
import {
  isCancellation,
  ReviewCancelledError,
  throwIfAborted,
} from './cancel.server'
import { browsers, codeBudgetChars, judgeMaxTokens } from './config.server'
import { explainFailures, judgeModelCriteria } from './judge.server'
import type { JudgeOutcome } from './judge.server'
import { createReviewLlm } from './llm.server'
import { artifactsPath, projectPath } from './paths.server'
import { runPlaywright } from './playwright.server'
import {
  extractProject,
  installDependencies,
  resolveProjectRoot,
  startDevServer,
} from './project.server'
import { collectSources } from './sources.server'
import { appendProgress, getReview, updateReview } from './store.server'

const MODEL_CODES = new Set(
  ADVANCED_CRITERIA.filter((criterion) => criterion.evaluation === 'model').map(
    (criterion) => criterion.code,
  ),
)

type Llm = ReturnType<typeof createReviewLlm>

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function advance(
  state: TaskState | null,
  to: TaskStage,
  at: string,
  reason: string,
): TaskState | null {
  if (!state) {
    return null
  }
  const outcome = transitionTask(state, to, { at, reason })
  return outcome.status === 'applied' ? outcome.state : state
}

function makeSink(reviewId: number, stage: StageId): (line: string) => void {
  let chain: Promise<unknown> = Promise.resolve()
  let count = 0
  const interesting =
    /error|err\b|warn|fail|Local:|ready|Vite|vite|deprecat|listen|port/i
  return (line: string) => {
    const text = line.trim()
    if (!text || count >= 120 || !interesting.test(text)) {
      return
    }
    count += 1
    chain = chain
      .then(() =>
        appendProgress({
          reviewId,
          stage,
          state: 'active',
          message: text.slice(0, 300),
        }),
      )
      .catch(() => undefined)
  }
}

async function report(
  reviewId: number,
  stage: StageId,
  state: StageState,
  text: string,
): Promise<void> {
  await appendProgress({ reviewId, stage, state, message: text })
}

async function prepare(
  rootPath: string | null,
  reviewId: number,
  zipPath: string | null,
): Promise<{ root: string | null; error: string | null }> {
  if (rootPath) {
    return { root: rootPath, error: null }
  }
  try {
    const target = await projectPath(reviewId)
    if (!zipPath) {
      return { root: null, error: 'архив проекта не найден' }
    }
    await extractProject(zipPath, target)
    const root = await resolveProjectRoot(target)
    await updateReview(reviewId, { rootPath: root })
    return { root, error: null }
  } catch (error) {
    return {
      root: null,
      error: `не удалось распаковать архив: ${message(error)}`,
    }
  }
}

async function trackApp(
  reviewId: number,
  root: string,
  signal?: AbortSignal,
): Promise<{ basic: BasicResult[]; failure: string | null }> {
  const sinkInstall = makeSink(reviewId, 'install')
  const sinkServe = makeSink(reviewId, 'serve')
  const sinkTests = makeSink(reviewId, 'tests')

  throwIfAborted(signal)
  await report(reviewId, 'install', 'active', 'npm install')
  try {
    await installDependencies(root, sinkInstall, signal)
  } catch (error) {
    if (isCancellation(error, signal)) {
      throw new ReviewCancelledError()
    }
    const reason = `проект не устанавливается: ${message(error)}`
    await report(reviewId, 'install', 'failed', reason)
    return { basic: unstartedPlaywrightResults(reason), failure: reason }
  }
  throwIfAborted(signal)
  await report(reviewId, 'install', 'done', 'зависимости установлены')

  await report(reviewId, 'serve', 'active', 'запуск дев-сервера')
  let server: Awaited<ReturnType<typeof startDevServer>>
  try {
    server = await startDevServer(root, sinkServe, signal)
  } catch (error) {
    if (isCancellation(error, signal)) {
      throw new ReviewCancelledError()
    }
    const reason = `проект не запускается: ${message(error)}`
    await report(reviewId, 'serve', 'failed', reason)
    return { basic: unstartedPlaywrightResults(reason), failure: reason }
  }
  await report(
    reviewId,
    'serve',
    'done',
    `приложение доступно на ${server.url}`,
  )

  try {
    throwIfAborted(signal)
    const artifacts = await artifactsPath(reviewId)
    await report(
      reviewId,
      'tests',
      'active',
      `Playwright: ${browsers().join(', ')}`,
    )
    const run = await runPlaywright({
      baseUrl: server.url,
      browsers: browsers(),
      artifactsDir: artifacts,
      onLine: sinkTests,
      signal,
    })
    if (!run.report) {
      const reason = `не удалось получить результаты тестов: ${run.error ?? 'нет отчёта'}`
      await report(reviewId, 'tests', 'failed', reason)
      return { basic: unstartedPlaywrightResults(reason), failure: reason }
    }
    await report(
      reviewId,
      'tests',
      'done',
      `тестов выполнено: ${run.report.tests.length}`,
    )
    return { basic: scorePlaywright(run.report), failure: null }
  } finally {
    server.stop()
  }
}

async function trackCode(
  reviewId: number,
  root: string | null,
  focusCodes: string[] | null,
  llm: Llm,
  signal?: AbortSignal,
): Promise<{
  files: SourceFile[]
  static: StaticCheckOutcome[]
  model: ModelVerdict[]
  modelError: string | null
}> {
  throwIfAborted(signal)
  if (!root) {
    return { files: [], static: [], model: [], modelError: null }
  }
  const files = await collectSources(root)
  throwIfAborted(signal)
  await report(
    reviewId,
    'static',
    'active',
    `прочитано файлов: ${files.length}`,
  )
  const statics = runStaticChecks(files)
  await report(reviewId, 'static', 'done', 'статические проверки выполнены')

  const modelCodes = focusCodes
    ? focusCodes.filter((code) => MODEL_CODES.has(code))
    : null
  if (modelCodes && modelCodes.length === 0) {
    return { files, static: statics, model: [], modelError: null }
  }

  await report(reviewId, 'judge', 'active', 'оценка критериев моделью')
  const outcome: JudgeOutcome = await judgeModelCriteria({
    llm,
    files,
    budget: codeBudgetChars(),
    maxTokens: judgeMaxTokens(),
    focusCodes: modelCodes,
  })
  throwIfAborted(signal)
  await report(
    reviewId,
    'judge',
    outcome.error ? 'failed' : 'done',
    outcome.error
      ? `модель недоступна: ${outcome.error}`
      : `оценено критериев: ${outcome.verdicts.length}`,
  )
  return {
    files,
    static: statics,
    model: outcome.verdicts,
    modelError: outcome.error,
  }
}

function focusFromPrevious(
  previous: { results: CriterionResult[] } | null,
): string[] | null {
  if (!previous) {
    return null
  }
  return previous.results
    .filter((result) => result.status === 'fail')
    .map((result) => result.code)
}

async function markCancelled(reviewId: number): Promise<void> {
  const review = await getReview(reviewId)
  const at = new Date().toISOString()
  const state = review?.state
    ? cancelTask(review.state, at, 'Проверка прервана пользователем')
    : null
  if (review?.status !== 'cancelled') {
    await report(
      reviewId,
      review?.stage ?? 'extract',
      'cancelled',
      'проверка прервана пользователем',
    )
  }
  await updateReview(reviewId, {
    status: 'cancelled',
    state,
    error: 'Проверка прервана пользователем',
    finishedAt: at,
  })
}

async function runPipeline(
  reviewId: number,
  signal?: AbortSignal,
): Promise<void> {
  const review = await getReview(reviewId)
  if (!review) {
    return
  }
  const at = new Date().toISOString()
  let state = review.state
  const previous = review.resumedFrom
    ? await getReview(review.resumedFrom)
    : null
  const focusCodes = focusFromPrevious(previous)

  await updateReview(reviewId, {
    status: 'running',
    stage: 'extract',
    error: null,
  })
  await report(reviewId, 'extract', 'active', 'получен проект')

  const prepared = await prepare(review.rootPath, reviewId, review.zipPath)
  throwIfAborted(signal)
  await report(
    reviewId,
    'extract',
    prepared.error ? 'failed' : 'done',
    prepared.error ?? 'проект распакован',
  )

  const llm = createReviewLlm()
  const [trackA, trackB] = await Promise.allSettled([
    prepared.root
      ? trackApp(reviewId, prepared.root, signal)
      : Promise.resolve({
          basic: unstartedPlaywrightResults(
            prepared.error ?? 'проект не получен',
          ),
          failure: prepared.error ?? 'проект не получен',
        }),
    trackCode(reviewId, prepared.root, focusCodes, llm, signal),
  ])
  throwIfAborted(signal)

  const appResult =
    trackA.status === 'fulfilled'
      ? trackA.value
      : {
          basic: unstartedPlaywrightResults(
            `сбой прогона приложения: ${message(trackA.reason)}`,
          ),
          failure: message(trackA.reason),
        }
  const codeResult =
    trackB.status === 'fulfilled'
      ? trackB.value
      : { files: [], static: [], model: [], modelError: message(trackB.reason) }

  await updateReview(reviewId, { stage: 'report' })
  await report(reviewId, 'report', 'active', 'сборка отчёта')

  const preliminary = assembleResults({
    at,
    playwright: appResult.basic,
    static: codeResult.static,
    model: codeResult.model,
    explanations: [],
    modelError: codeResult.modelError,
  })
  const deterministicFailures = preliminary.filter(
    (result) => result.status === 'fail' && !MODEL_CODES.has(result.code),
  )
  const explainTargets = focusCodes
    ? deterministicFailures.filter((result) => focusCodes.includes(result.code))
    : deterministicFailures

  let explanations: ModelVerdict[] = []
  if (explainTargets.length > 0) {
    await report(
      reviewId,
      'judge',
      'active',
      `замечания: ${explainTargets.length}`,
    )
    const outcome = await explainFailures({
      llm,
      failed: explainTargets,
      maxTokens: judgeMaxTokens(),
    })
    throwIfAborted(signal)
    explanations = outcome.verdicts
    if (outcome.error) {
      await report(
        reviewId,
        'judge',
        'failed',
        `замечания моделью не сформулированы: ${outcome.error}`,
      )
    }
  }

  let results = assembleResults({
    at,
    playwright: appResult.basic,
    static: codeResult.static,
    model: codeResult.model,
    explanations,
    modelError: codeResult.modelError,
  })

  if (focusCodes && previous) {
    const carried = new Map(
      previous.results.map((result) => [result.code, result]),
    )
    results = results.map((result) =>
      focusCodes.includes(result.code)
        ? result
        : (carried.get(result.code) ?? result),
    )
  }

  const evaluated = results.filter(
    (result) => result.status !== 'not_checked',
  ).length
  const reportReady =
    results.length === CRITERIA.length &&
    (evaluated > 0 || appResult.failure !== null)
  const validationReason = reportReady
    ? 'Отчёт создан: вердикт есть у каждого критерия.'
    : 'Отчёт неполный: ни один критерий не проверен.'

  state = advance(
    state,
    'validation',
    new Date().toISOString(),
    validationReason,
  )
  await report(
    reviewId,
    'report',
    reportReady ? 'done' : 'failed',
    validationReason,
  )

  const finishedAt = new Date().toISOString()
  if (!reportReady) {
    await updateReview(reviewId, {
      status: 'failed',
      stage: 'report',
      state,
      error: validationReason,
      results,
      finishedAt,
    })
    return
  }

  state = advance(state, 'done', finishedAt, 'Проверка завершена')
  await updateReview(reviewId, {
    status: 'done',
    stage: 'report',
    state,
    error: appResult.failure,
    results,
    finishedAt,
  })
}

export async function runReviewPipeline(
  reviewId: number,
  signal?: AbortSignal,
): Promise<void> {
  try {
    await runPipeline(reviewId, signal)
  } catch (error) {
    if (isCancellation(error, signal)) {
      await markCancelled(reviewId)
      return
    }
    throw error
  }
}
