import { describe, expect, it } from 'vitest'
import { dot } from '../domain/embedder'
import {
  createLocalEmbedder,
  resolveEmbedModelId,
  resolveModelConfig,
} from '../server/embedder.server'

const runModelTests = process.env.RUN_MODEL_TESTS === '1'

describe.skipIf(!runModelTests)('local embedder (real model)', () => {
  it('embeds related text closer than unrelated', async () => {
    const embedder = createLocalEmbedder()
    const [passage] = await embedder.embed(
      ['Москва является столицей России'],
      'passage',
    )
    const [related] = await embedder.embed(['Столица России — Москва'], 'query')
    const [unrelated] = await embedder.embed(['Рецепт борща со свёклой'], 'query')
    expect(dot(related, passage)).toBeGreaterThan(dot(unrelated, passage))
  }, 120_000)

  it('exposes the configured model and dimension', () => {
    const modelId = resolveEmbedModelId()
    const config = resolveModelConfig(modelId)
    expect(createLocalEmbedder(modelId).dim).toBe(config.dim)
  })
})
