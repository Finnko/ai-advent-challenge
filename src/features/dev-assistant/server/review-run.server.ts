import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AnswerGenerator } from '@lib/rag-engine.types'
import type { PullRequestDiff } from '../domain/pr-diff'
import { changedLinesByPath } from '../domain/pr-diff'
import {
  renderInlineComment,
  renderReviewBody,
  splitFindings,
  type AnchoredFinding,
} from '../domain/review-report'
import {
  deliverInline,
  deliverSummary,
  writeStepSummary,
  type GitHubConfig,
  type ReviewComment,
} from './github.server'
import { readPullRequestDiff } from './pr-diff.server'
import { judgeFindings } from './review-judge.server'
import { buildReviewIndex } from './review-index.server'
import { reviewPullRequest } from './review.server'
import { getDevAssistantStore } from './store.server'

const execFileAsync = promisify(execFile)
const TYPECHECK_MAX_LINES = 80

export type ReviewRunOptions = {
  root: string
  base: string
  head: string
  prNumber: number | null
  generator: AnswerGenerator
  dryRun: boolean
  judge: boolean
  githubToken: string | null
  githubRepository: string | null
  runTypecheck: boolean
}

export type ReviewRunResult = {
  ok: boolean
  body: string
  error: string | null
  files: number
  lines: number
  inline: number
  kept: number
  dropped: number
  truncated: boolean
  model: string | null
}

function clipLines(text: string, maxLines: number): string {
  const lines = text.split('\n')
  if (lines.length <= maxLines) {
    return text.trim()
  }
  return `${lines.slice(0, maxLines).join('\n').trim()}\n… (обрезано)`
}

function execOutput(error: unknown): string {
  if (error !== null && typeof error === 'object') {
    const record = error as { stdout?: unknown; stderr?: unknown }
    const stdout = typeof record.stdout === 'string' ? record.stdout : ''
    const stderr = typeof record.stderr === 'string' ? record.stderr : ''
    return `${stdout}${stderr}`.trim()
  }
  return ''
}

// Deterministic ground truth for the model (Q15): the typecheck output joins the
// diff as one more context block, so findings can point at real errors instead
// of guessed ones. A failing typecheck is information, not a pipeline failure.
async function typecheckBlock(root: string): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(
      'npm',
      ['run', 'typecheck'],
      {
        cwd: root,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
        env: process.env,
      },
    )
    const output = `${String(stdout)}${String(stderr)}`.trim()
    return `### Проверка типов\n${output.length > 0 ? clipLines(output, TYPECHECK_MAX_LINES) : 'Ошибок нет.'}`
  } catch (error) {
    const output = execOutput(error)
    let message = output
    if (message.length === 0) {
      message = error instanceof Error ? error.message : String(error)
    }
    return `### Проверка типов\n${clipLines(message, TYPECHECK_MAX_LINES)}`
  }
}

function diffContextBlocks(diff: PullRequestDiff): string[] {
  const files = diff.files
    .map((file) => `- ${file.status} ${file.path} (+${file.addedCount})`)
    .join('\n')
  return [
    `### Pull request\nБаза: ${diff.base}\nHead: ${diff.head}`,
    `### Изменённые файлы\n${files}`,
    `### Дифф\n\`\`\`diff\n${diff.text}\n\`\`\``,
  ]
}

function renderUnavailable(reason: string): string {
  return `## 🤖 AI-ревью\n\nAI-ревью недоступно: ${reason}`
}

function canPublish(options: ReviewRunOptions): boolean {
  return (
    !options.dryRun &&
    options.prNumber !== null &&
    Boolean(options.githubToken) &&
    Boolean(options.githubRepository)
  )
}

function githubConfig(options: ReviewRunOptions): GitHubConfig {
  return {
    token: options.githubToken ?? '',
    repository: options.githubRepository ?? '',
    pullNumber: options.prNumber ?? 0,
    headSha: options.head,
  }
}

async function publishInline(
  options: ReviewRunOptions,
  entries: AnchoredFinding[],
): Promise<AnchoredFinding[]> {
  if (!canPublish(options)) {
    return []
  }
  const comments: ReviewComment[] = entries.map((entry) => ({
    path: entry.path,
    line: entry.line,
    body: renderInlineComment(entry.finding),
  }))
  const result = await deliverInline(githubConfig(options), comments)
  const failed = new Set(
    result.failed.map((comment) => `${comment.path}:${comment.line}`),
  )
  return entries.filter((entry) => failed.has(`${entry.path}:${entry.line}`))
}

async function publishSummary(
  options: ReviewRunOptions,
  body: string,
): Promise<void> {
  if (canPublish(options)) {
    await deliverSummary(githubConfig(options), body)
  }
  await writeStepSummary(body)
}

// The Day-32 orchestrator: diff → fresh review index → model → anchor
// validation → delivery. It never throws and never fails the job — a broken
// model or index degrades to a visible note (Q16), because the review is
// advisory.
export async function runPullRequestReview(
  options: ReviewRunOptions,
): Promise<ReviewRunResult> {
  let summaryPosted = false
  try {
    const diff = await readPullRequestDiff({
      root: options.root,
      base: options.base,
      head: options.head,
    })
    if (diff.files.length === 0) {
      const body = `## 🤖 AI-ревью\n\nВ диффе нет изменений, требующих ревью.`
      await publishSummary(options, body)
      summaryPosted = true
      return {
        ok: true,
        body,
        error: null,
        files: 0,
        lines: 0,
        inline: 0,
        kept: 0,
        dropped: 0,
        truncated: diff.truncated,
        model: null,
      }
    }

    const store = await getDevAssistantStore()
    await buildReviewIndex(options.root)
    const contextBlocks = diffContextBlocks(diff)
    if (options.runTypecheck) {
      const block = await typecheckBlock(options.root)
      if (block) {
        contextBlocks.push(block)
      }
    }

    const review = await reviewPullRequest({
      store,
      generator: options.generator,
      contextBlocks,
    })
    const judged = options.judge
      ? await judgeFindings({
          findings: review.report.findings,
          chunks: review.sources.map((source) => source.chunk),
          contextBlocks,
          generator: options.generator,
        })
      : null
    const findings = judged ? judged.kept : review.report.findings
    const { inline, summary } = splitFindings(
      findings,
      changedLinesByPath(diff.files),
    )
    const failed = await publishInline(options, inline)
    const body = renderReviewBody({
      report: { ...review.report, findings },
      meta: {
        model: review.model,
        files: diff.files.length,
        lines: diff.changedLines,
        truncated: diff.truncated,
        omitted: diff.omitted,
        judge: judged
          ? {
              kept: judged.kept.length,
              dropped: judged.dropped.length,
              filtered: judged.filtered,
              error: judged.error,
            }
          : null,
      },
      summaryFindings: [...summary, ...failed.map((entry) => entry.finding)],
      droppedFindings: judged?.dropped ?? [],
    })
    await publishSummary(options, body)
    summaryPosted = true
    return {
      ok: true,
      body,
      error: null,
      files: diff.files.length,
      lines: diff.changedLines,
      inline: inline.length - failed.length,
      kept: findings.length,
      dropped: judged?.dropped.length ?? 0,
      truncated: diff.truncated,
      model: review.model,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const body = renderUnavailable(message)
    if (!summaryPosted) {
      try {
        await publishSummary(options, body)
      } catch {
        // Best effort: the job still exits green with the reason on stdout.
      }
    }
    return {
      ok: false,
      body,
      error: message,
      files: 0,
      lines: 0,
      inline: 0,
      kept: 0,
      dropped: 0,
      truncated: false,
      model: null,
    }
  }
}
