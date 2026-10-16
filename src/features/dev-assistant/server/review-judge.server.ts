import type { ChatUsage } from '@lib/llm'
import type { AnswerLlm } from '@lib/rag-engine.server'
import { buildSourceMessages, resolveAnswerLlm } from '@lib/rag-engine.server'
import type { AnswerGenerator, Chunk } from '@lib/rag-engine.types'
import { JUDGE_PERSONA, JUDGE_QUESTION } from '../domain/review-judge-prompt'
import type { ReviewFinding } from '../domain/review-report'
import {
  applyVerdicts,
  parseVerdicts,
  type JudgeOutcome,
} from '../domain/review-verdict'

export const JUDGE_MAX_TOKENS = 1500

export type JudgeInput = {
  findings: ReviewFinding[]
  chunks: Chunk[]
  contextBlocks?: string[]
  generator: AnswerGenerator
  llm?: AnswerLlm
}

export type JudgeResult = JudgeOutcome & {
  model: string | null
  usage: ChatUsage | null
  latencyMs: number
  error: string | null
}

function findingLocation(finding: ReviewFinding): string {
  if (!finding.file) {
    return '—'
  }
  return finding.line > 0
    ? `${finding.file}:${finding.line}`
    : finding.file
}

function renderFindingsBlock(findings: ReviewFinding[]): string {
  const lines = findings.map((finding, index) => {
    const suggestion =
      finding.suggestion.length > 0
        ? `\n   Как исправить: ${finding.suggestion}`
        : ''
    return `${index + 1}. [${finding.severity}] ${findingLocation(finding)} — ${finding.message}${suggestion}`
  })
  return `### Находки ревью (для проверки)\n${lines.join('\n')}`
}

export async function judgeFindings(input: JudgeInput): Promise<JudgeResult> {
  const failOpen = (error: string | null): JudgeResult => ({
    ...applyVerdicts(input.findings, null),
    model: null,
    usage: null,
    latencyMs: 0,
    error,
  })

  if (input.findings.length === 0) {
    return failOpen(null)
  }

  const llm = input.llm ?? resolveAnswerLlm(input.generator)
  const contextBlocks = (input.contextBlocks ?? []).filter(
    (block) => block.trim().length > 0,
  )
  const messages = buildSourceMessages({
    question: JUDGE_QUESTION,
    persona: JUDGE_PERSONA,
    chunks: input.chunks,
    contextBlocks: [...contextBlocks, renderFindingsBlock(input.findings)],
  })

  try {
    const reply = await llm(messages, {
      json: true,
      maxTokens: JUDGE_MAX_TOKENS,
    })
    const verdicts = parseVerdicts(reply.content)
    return {
      ...applyVerdicts(input.findings, verdicts),
      model: reply.model,
      usage: reply.usage,
      latencyMs: reply.latencyMs,
      error: verdicts === null ? 'судья вернул неразборчивый ответ' : null,
    }
  } catch (error) {
    return failOpen(error instanceof Error ? error.message : String(error))
  }
}
