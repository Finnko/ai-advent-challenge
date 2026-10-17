import type { CallLLM } from '@lib/agent-loop/types'
import type { ModelVerdict } from '../domain/contract'
import { parseVerdicts } from '../domain/contract'
import {
  buildExplanationPrompt,
  buildJudgePrompt,
  packCodeContext,
} from '../domain/prompt'
import type { SourceFile } from '../domain/sources'
import type { CriterionResult } from '../types'

export type JudgeOutcome = {
  verdicts: ModelVerdict[]
  error: string | null
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function ask(
  llm: CallLLM,
  pair: { system: string; user: string },
  maxTokens: number,
): Promise<JudgeOutcome> {
  try {
    const reply = await llm({
      max_tokens: maxTokens,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: pair.system },
        { role: 'user', content: pair.user },
      ],
    })
    const verdicts = parseVerdicts(reply.content)
    if (verdicts.length === 0) {
      return { verdicts: [], error: 'модель вернула ответ без вердиктов' }
    }
    return { verdicts, error: null }
  } catch (error) {
    return { verdicts: [], error: describe(error) }
  }
}

export async function judgeModelCriteria(input: {
  llm: CallLLM
  files: SourceFile[]
  budget: number
  maxTokens: number
  focusCodes: string[] | null
}): Promise<JudgeOutcome> {
  const codeContext = packCodeContext(input.files, input.budget)
  return ask(
    input.llm,
    buildJudgePrompt(codeContext, input.focusCodes),
    input.maxTokens,
  )
}

export async function explainFailures(input: {
  llm: CallLLM
  failed: CriterionResult[]
  maxTokens: number
}): Promise<JudgeOutcome> {
  if (input.failed.length === 0) {
    return { verdicts: [], error: null }
  }
  return ask(input.llm, buildExplanationPrompt(input.failed), input.maxTokens)
}
