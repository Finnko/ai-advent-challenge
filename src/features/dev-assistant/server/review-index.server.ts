import {
  buildIndex,
  createEmbedder,
  type BuildIndexResult,
} from '@lib/rag-engine.server'
import { createReviewCorpus } from './review-corpus.server'
import { REVIEW_STRATEGY, reviewChunker } from './review-chunker.server'
import { getDevAssistantStore } from './store.server'

// Day-32: a fresh index over docs + code, built from the checkout under review.
// It shares the feature's SQLite file but not the chat's `markdown` strategy, so
// reindexing for a pull request never disturbs `/dev-assistant`.
export async function buildReviewIndex(
  root: string,
): Promise<BuildIndexResult> {
  const store = await getDevAssistantStore()
  return buildIndex({
    strategy: REVIEW_STRATEGY,
    chunker: reviewChunker,
    corpus: await createReviewCorpus({ root }),
    embedder: createEmbedder(),
    store,
  })
}
