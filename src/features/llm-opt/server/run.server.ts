import type { LocalLlmDeps } from '@lib/local-llm.server'
import { resolveLocalModel, runLocalChat } from '@lib/local-llm.server'
import type { ChatUsage } from '@lib/llm'
import type { ExperimentConfig } from '../data/configs'
import { findDoc } from '../data/dataset'
import { TASK_PROFILE } from '../data/profile'
import { buildPromptMessages } from '../data/prompts'
import { parseExtraction } from '../domain/extraction'
import { gradeExtraction } from '../domain/metric'
import { runId, type StoredRun } from '../domain/results'
import { sampleMlxMemoryMb } from './resource.server'

export type RunDeps = LocalLlmDeps & {
  sampleRss?: () => number | null
  now?: () => Date
}

function tokensPerSecond(
  usage: ChatUsage | null,
  latencyMs: number,
): number | null {
  if (!usage || usage.completion_tokens <= 0 || latencyMs <= 0) {
    return null
  }
  return Math.round((usage.completion_tokens / (latencyMs / 1000)) * 10) / 10
}

export async function runExtraction(
  config: ExperimentConfig,
  docId: string,
  repeat: number,
  deps: RunDeps = {},
): Promise<StoredRun> {
  const doc = findDoc(docId)
  if (!doc) {
    throw new Error(`Неизвестный документ: ${docId}`)
  }
  const context = TASK_PROFILE.contextFor(doc, config.contextMode)
  const messages = buildPromptMessages(config.promptId, context)
  const sampleRss = deps.sampleRss ?? sampleMlxMemoryMb

  const memBeforeMb = sampleRss()
  const reply = await runLocalChat(
    messages,
    {
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      ...(config.jsonMode
        ? { response_format: { type: 'json_object' as const } }
        : {}),
    },
    deps,
  )
  const memAfterMb = sampleRss()

  const model = reply.model ?? resolveLocalModel()
  const parsed = parseExtraction(reply.content)
  const graded = gradeExtraction(doc.gold, parsed.facts)
  const latencyMs = reply.latencyMs ?? 0

  return {
    id: runId(model, config.id, docId, repeat),
    model,
    config,
    docId,
    repeat,
    raw: reply.content,
    facts: parsed.facts,
    format: parsed.format,
    fields: graded.fields,
    score: graded.score,
    valid: graded.valid,
    latencyMs,
    usage: reply.usage,
    tokensPerSecond: tokensPerSecond(reply.usage, latencyMs),
    memBeforeMb,
    memAfterMb,
    createdAt: (deps.now?.() ?? new Date()).toISOString(),
  }
}
