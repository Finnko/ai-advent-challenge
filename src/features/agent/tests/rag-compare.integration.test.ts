import { describe, expect, it } from 'vitest'
import { TIER_ENDPOINTS } from '@lib/llm'
import { apiKeyFor, callCompletions } from '@lib/llm.server'
import { agentRagCapability } from '@/lib/agent-rag.server'
import type { CallLLM } from '../domain/agent'
import { windowStrategy } from '../domain/context/window'
import { statesEarlier } from '../domain/scenario-score'
import type { AgentRuntime } from '../server/agent-service.server'
import {
  defaultAgentRuntime,
  executeAgent,
} from '../server/agent-service.server'
import {
  createCapabilities,
  createFakeStore,
  createIdentity,
} from './agent-testkit'

const run =
  process.env.RUN_MODEL_TESTS === '1' && process.env.RUN_NETWORK_TESTS === '1'

const RUNS = Number(process.env.COMPARE_RUNS ?? '6')

const STEP1 = 'Сравни Москву и Санкт-Петербург в целом.'
const STEP1_ANSWER =
  'Москва — столица России, Санкт-Петербург — культурная столица. Оба города крупнейшие в стране.'
const QUESTION = 'Какой из этих двух городов основан раньше?'

const realCallLLM: CallLLM = async ({
  messages,
  temperature,
  response_format,
  max_tokens,
}) => {
  const apiKey = apiKeyFor('DEEPSEEK_API_KEY')
  const reply = await callCompletions(TIER_ENDPOINTS.medium, apiKey, messages, {
    temperature,
    response_format,
    max_tokens,
  })
  return {
    content: reply.content,
    usage: reply.usage,
    latencyMs: reply.latencyMs ?? 0,
  }
}

describe.runIf(run)('agent RAG · compare-two-cities step 2', () => {
  it(`names Москва first as the earlier city in ${RUNS} runs`, async (ctx) => {
    const history = [
      { role: 'user' as const, content: STEP1 },
      { role: 'assistant' as const, content: STEP1_ANSWER },
    ]
    const contribution = await agentRagCapability.prepare({
      query: QUESTION,
      token: 'compare-regression',
      history,
    })
    if (contribution.sources.length === 0) {
      ctx.skip()
      return
    }

    const runtime: AgentRuntime = {
      ...defaultAgentRuntime,
      callLLM: realCallLLM,
      store: createFakeStore(),
      createTools: () => [],
      loadMcpTools: undefined,
    }
    const capabilities = createCapabilities(
      createIdentity(),
      contribution.tools.map((tool) => tool.name),
    )

    const failures: string[] = []
    for (let index = 0; index < RUNS; index += 1) {
      const execution = await executeAgent(
        {
          capabilities,
          user: QUESTION,
          strategy: windowStrategy,
          rows: [
            { id: 1, role: 'user', content: STEP1 },
            { id: 2, role: 'assistant', content: STEP1_ANSWER },
          ],
          windowSize: 10,
          taskStateEnabled: false,
          now: new Date(),
          extraBlocks: contribution.block ? [contribution.block] : [],
          extraTools: contribution.tools,
        },
        runtime,
      )
      const answer = execution.run.answer
      if (!statesEarlier(answer, 'Москва', 'Санкт-Петербург')) {
        failures.push(answer)
      }
    }

    expect(failures).toEqual([])
  }, 600_000)
})
