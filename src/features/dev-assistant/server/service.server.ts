import type { GitContext } from '@lib/git-context.types'
import { collectGitContext } from '@lib/git-context.server'
import {
  buildIndex,
  createEmbedder,
  resolveEmbedModelId,
  type BuildIndexResult,
  type DocumentRecord,
} from '@lib/rag-engine.server'
import type {
  AnswerGenerator,
  ChunkingStrategyId,
  CorpusDocStatus,
} from '@lib/rag-engine.types'
import { answerAboutProject, type ProjectAnswerResult } from './core.server'
import { markdownChunker } from './markdown-chunker.server'
import { createProjectCorpus, resolveRepoRoot } from './project-corpus.server'
import { getDevAssistantStore } from './store.server'

export const DEV_ASSISTANT_STRATEGY: ChunkingStrategyId = 'structural'
export const DEV_ASSISTANT_K = 6

export type DevAssistantIndexStats = {
  documents: DocumentRecord[]
  chunkCount: number
  model: string | null
  builtAt: string | null
  dim: number
  embedModel: string
}

export async function buildDevAssistantIndex(): Promise<BuildIndexResult> {
  const store = await getDevAssistantStore()
  return buildIndex({
    strategy: DEV_ASSISTANT_STRATEGY,
    chunker: markdownChunker,
    corpus: createProjectCorpus({ root: resolveRepoRoot() }),
    embedder: createEmbedder(),
    store,
  })
}

export async function getDevAssistantIndexStats(): Promise<DevAssistantIndexStats> {
  const store = await getDevAssistantStore()
  return {
    documents: store.listDocuments(),
    chunkCount: store.countChunks(DEV_ASSISTANT_STRATEGY),
    model: store.getMeta(`${DEV_ASSISTANT_STRATEGY}.model`),
    builtAt: store.getMeta(`${DEV_ASSISTANT_STRATEGY}.built_at`),
    dim: Number(store.getMeta(`${DEV_ASSISTANT_STRATEGY}.dim`) ?? 0),
    embedModel: resolveEmbedModelId(),
  }
}

export async function getDevAssistantCorpus(): Promise<CorpusDocStatus[]> {
  const corpus = createProjectCorpus({ root: resolveRepoRoot() })
  return corpus.status(await corpus.list())
}

export type DevAssistantAnswer = ProjectAnswerResult & {
  gitContext: GitContext
}

export async function askDevAssistant(input: {
  question: string
  generator: AnswerGenerator
}): Promise<DevAssistantAnswer> {
  const store = await getDevAssistantStore()
  if (store.countChunks(DEV_ASSISTANT_STRATEGY) === 0) {
    throw new Error(
      'Индекс ассистента пуст — соберите его кнопкой «Переиндексировать».',
    )
  }
  const gitContext = await collectGitContext()
  const answer = await answerAboutProject({
    question: input.question,
    strategy: DEV_ASSISTANT_STRATEGY,
    store,
    generator: input.generator,
    k: DEV_ASSISTANT_K,
    contextBlocks: gitContext.block ? [gitContext.block] : [],
  })
  return { ...answer, gitContext }
}

export { collectGitContext }
