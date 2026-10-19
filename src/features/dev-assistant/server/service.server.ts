import type { GitContext } from '../domain/git/context'
import {
  buildIndex,
  createEmbedder,
  resolveEmbedModelId,
  type BuildIndexResult,
  type DocumentRecord,
} from '@lib/rag-engine.server'
import type { AnswerGenerator, CorpusDocStatus } from '@lib/rag-engine.types'
import { createMarkdownChunker } from '@lib/chunking/markdown.server'
import {
  answerAboutProject,
  DEV_ASSISTANT_STRATEGY,
  type ProjectAnswerResult,
} from './core.server'
import { collectGitContext } from './git-context.server'
import { createProjectCorpus, resolveRepoRoot } from './project-corpus.server'
import { getDevAssistantStore } from './store.server'

const markdownChunker = createMarkdownChunker({ id: DEV_ASSISTANT_STRATEGY })

export { DEV_ASSISTANT_STRATEGY }

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
  const gitContext = await collectGitContext()
  const answer = await answerAboutProject({
    question: input.question,
    store,
    generator: input.generator,
    contextBlocks: gitContext.block ? [gitContext.block] : [],
  })
  return { ...answer, gitContext }
}

export { collectGitContext }
