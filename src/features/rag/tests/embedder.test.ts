import { describe, expect, it } from 'vitest'
import { createHashEmbedder, dot, hashEmbedding, l2Normalize } from '../domain/embedder'

describe('hash embedding', () => {
  it('is deterministic and normalised', () => {
    const a = hashEmbedding('Москва столица России', 128)
    const b = hashEmbedding('Москва столица России', 128)
    expect(a).toEqual(b)
    expect(dot(a, a)).toBeCloseTo(1, 5)
  })

  it('scores related text higher than unrelated', () => {
    const query = hashEmbedding('столица России Москва', 256)
    const related = hashEmbedding('Москва является столицей России', 256)
    const unrelated = hashEmbedding('Казань столица Татарстана', 256)
    expect(dot(query, related)).toBeGreaterThan(dot(query, unrelated))
  })

  it('normalizes zero vectors without changing them', () => {
    const zero = new Float32Array([0, 0, 0])
    expect(l2Normalize(zero)).toEqual(zero)
  })

  it('exposes an embedder over batches', async () => {
    const embedder = createHashEmbedder(64)
    const vectors = await embedder.embed(['один', 'два'], 'passage')
    expect(vectors).toHaveLength(2)
    expect(vectors[0]).toHaveLength(64)
  })
})
