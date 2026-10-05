import type {
  ChunkingStrategyId,
  ScoredChunk,
} from '@/features/rag/domain/types'
import { parseCitations } from '@/features/rag/domain/answer-eval'
import { createEmbedder } from '@/features/rag/server/embedder.server'
import { getRagStore } from '@/features/rag/server/index-store.server'
import {
  createReranker,
  resolveRerankMargin,
  resolveRerankThreshold,
} from '@/features/rag/server/reranker.server'
import { retrieve } from '@/features/rag/server/retrieval.server'
import type { AgentCapability } from '@/features/agent/domain/capabilities/types'
import type { RetrievedSource } from '@/features/agent/domain/capabilities/types'
import { groundingFor } from '@/features/agent/domain/rag/grounding'
import { buildRagBlock } from '@/features/agent/domain/rag/prompt'
import { createRagSearchTool } from '@/features/agent/domain/rag/tool'
import {
  AGENT_RAG_CAPABILITY_ID,
  registerAgentCapability,
} from '@/features/agent/server/capability-registry.server'

export const AGENT_RAG_STRATEGY: ChunkingStrategyId = 'structural'
export const AGENT_RAG_K = 6

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
  if (store.countChunks(AGENT_RAG_STRATEGY) === 0) {
    return []
  }
  const threshold = resolveRerankThreshold()
  const result = await retrieve({
    strategy: AGENT_RAG_STRATEGY,
    query,
    k: AGENT_RAG_K,
    embedder: createEmbedder(),
    store,
    reranker: createReranker(),
    threshold,
    margin: resolveRerankMargin(),
  })
  return result.results
    .map(toSource)
    .filter(
      (source) =>
        source.relevance === undefined || source.relevance >= threshold,
    )
}

export const agentRagCapability: AgentCapability = {
  id: AGENT_RAG_CAPABILITY_ID,
  async prepare({ query }) {
    const sources = await retrieveSources(query)
    const tool = createRagSearchTool(retrieveSources)
    return {
      block: sources.length > 0 ? buildRagBlock(sources) : null,
      sources,
      tools: [tool],
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
