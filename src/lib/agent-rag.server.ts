import type {
  ChunkingStrategyId,
  ScoredChunk,
} from '@/features/rag/domain/types'
import { parseCitations } from '@/features/rag/domain/answer-eval'
import { rewriteQuery } from '@/features/rag/domain/rewrite-prompt'
import type { SearchScope } from '@/features/rag/domain/search-scope'
import { getRagStore } from '@/features/rag/server/index-store.server'
import { createDefaultRewriter } from '@/features/rag/server/rewrite.server'
import { searchSources } from '@/features/rag/server/search.server'
import type { AgentCapability } from '@/features/agent/domain/capabilities/types'
import type { RetrievedSource } from '@/features/agent/domain/capabilities/types'
import { groundingFor } from '@/features/agent/domain/rag/grounding'
import { planRagQuery } from '@/features/agent/domain/rag/plan'
import { buildRagBlock } from '@/features/agent/domain/rag/prompt'
import { createRagSearchTool } from '@/features/agent/domain/rag/tool'
import {
  AGENT_RAG_CAPABILITY_ID,
  registerAgentCapability,
} from '@/features/agent/server/capability-registry.server'

export const AGENT_RAG_STRATEGY: ChunkingStrategyId = 'structural'
export const AGENT_RAG_K = 6

const AGENT_RAG_SCOPE: SearchScope = {
  strategy: AGENT_RAG_STRATEGY,
  k: AGENT_RAG_K,
  rerank: true,
  rewrite: false,
}

function toSource(scored: ScoredChunk): RetrievedSource {
  return {
    chunkId: scored.chunk.chunkId,
    title: scored.chunk.title,
    section: scored.chunk.section,
    source: scored.chunk.source,
    text: scored.chunk.text,
    score: scored.score,
    originalScore: scored.originalScore,
    relevance: scored.relevance,
  }
}

async function retrieveSources(query: string): Promise<RetrievedSource[]> {
  const store = await getRagStore()
  if (store.countChunks(AGENT_RAG_SCOPE.strategy) === 0) {
    return []
  }
  const outcome = await searchSources({
    scope: AGENT_RAG_SCOPE,
    query,
    store,
  })
  return outcome.sources
    .map(toSource)
    .filter(
      (source) =>
        source.relevance === undefined || source.relevance >= outcome.threshold,
    )
}

const rewriter = createDefaultRewriter()
const ragSearchTool = createRagSearchTool(retrieveSources)

export const agentRagCapability: AgentCapability = {
  id: AGENT_RAG_CAPABILITY_ID,
  async prepare({ query, history }) {
    const plan = await planRagQuery({
      query,
      history,
      rewrite: (question, turns) => rewriteQuery(question, rewriter, turns),
    })
    if (plan.kind === 'live') {
      return { block: null, sources: [], tools: [ragSearchTool] }
    }
    const sources = await retrieveSources(plan.query)
    return {
      block: sources.length > 0 ? buildRagBlock(sources) : null,
      sources,
      tools: [ragSearchTool],
    }
  },
  classify(answer, sources) {
    const citations = parseCitations(answer).filter(
      (index) => index >= 1 && index <= sources.length,
    )
    return { grounding: groundingFor(citations, sources), citations }
  },
}

registerAgentCapability(agentRagCapability)
