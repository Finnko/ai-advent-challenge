export type EmbedKind = 'query' | 'passage'

export type Embedder = {
  id: string
  dim: number
  embed(texts: string[], kind: EmbedKind): Promise<Float32Array[]>
}

export function l2Normalize(vector: Float32Array): Float32Array {
  let sum = 0
  for (const value of vector) {
    sum += value * value
  }
  const norm = Math.sqrt(sum)
  if (norm === 0) {
    return vector
  }
  const out = new Float32Array(vector.length)
  for (let index = 0; index < vector.length; index += 1) {
    out[index] = vector[index] / norm
  }
  return out
}

export function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0
  const length = Math.min(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    sum += a[index] * b[index]
  }
  return sum
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
}

export function hashEmbedding(text: string, dim: number): Float32Array {
  const vector = new Float32Array(dim)
  const tokens = words(text)
  for (let index = 0; index < tokens.length; index += 1) {
    const word = tokens[index]
    vector[fnv1a(word) % dim] += 1
    const next = tokens[index + 1]
    if (next !== undefined) {
      vector[fnv1a(`${word}_${next}`) % dim] += 0.5
    }
  }
  return l2Normalize(vector)
}

export function createHashEmbedder(dim = 256): Embedder {
  return {
    id: `hash-${dim}`,
    dim,
    async embed(texts) {
      return texts.map((text) => hashEmbedding(text, dim))
    },
  }
}
