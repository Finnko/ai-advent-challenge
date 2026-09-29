import type { EmbedKind, Embedder } from '../domain/embedder'
import { l2Normalize } from '../domain/embedder'
import { apiKeyFor } from '@lib/llm.server'

export const DEFAULT_EMBED_MODEL = 'Xenova/multilingual-e5-base'
export const HF_EMBEDDINGS_URL = 'https://router.huggingface.co/v1/embeddings'

type ModelConfig = {
  queryPrefix: string
  passagePrefix: string
  pooling: 'mean' | 'cls'
  dim: number
}

export type EmbedDtype = 'q8' | 'fp32' | 'fp16' | 'int8'

const E5_CONFIG = (dim: number): ModelConfig => ({
  queryPrefix: 'query: ',
  passagePrefix: 'passage: ',
  pooling: 'mean',
  dim,
})

export function resolveModelConfig(modelId: string): ModelConfig {
  const lower = modelId.toLowerCase()
  if (lower.includes('e5-large')) {
    return E5_CONFIG(1024)
  }
  if (lower.includes('e5-base')) {
    return E5_CONFIG(768)
  }
  if (lower.includes('e5-small')) {
    return E5_CONFIG(384)
  }
  if (lower.includes('bge-m3')) {
    return { queryPrefix: '', passagePrefix: '', pooling: 'cls', dim: 1024 }
  }
  return { queryPrefix: '', passagePrefix: '', pooling: 'mean', dim: 768 }
}

export function resolveEmbedModelId(): string {
  return process.env.RAG_EMBED_MODEL?.trim() || DEFAULT_EMBED_MODEL
}

export function resolveEmbedDtype(): EmbedDtype {
  const value = process.env.RAG_EMBED_DTYPE?.trim()
  if (value === 'fp32' || value === 'fp16' || value === 'int8') {
    return value
  }
  return 'q8'
}

type Extractor = (
  texts: string[],
  options: { pooling: 'mean' | 'cls'; normalize: boolean },
) => Promise<{ tolist(): number[][] }>

let extractorPromise: Promise<Extractor> | null = null
let extractorKey: string | null = null

async function getExtractor(
  modelId: string,
  dtype: EmbedDtype,
): Promise<Extractor> {
  const key = `${modelId}:${dtype}`
  if (!extractorPromise || extractorKey !== key) {
    extractorKey = key
    extractorPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers')
      const pipe = await pipeline('feature-extraction', modelId, { dtype })
      return pipe as unknown as Extractor
    })()
  }
  return extractorPromise
}

function prefixFor(config: ModelConfig, kind: EmbedKind): string {
  return kind === 'query' ? config.queryPrefix : config.passagePrefix
}

export function createLocalEmbedder(modelId = resolveEmbedModelId()): Embedder {
  const config = resolveModelConfig(modelId)
  const dtype = resolveEmbedDtype()
  return {
    id: `local:${modelId}`,
    dim: config.dim,
    async embed(texts, kind) {
      const extractor = await getExtractor(modelId, dtype)
      const prefix = prefixFor(config, kind)
      const input = texts.map((text) => `${prefix}${text}`)
      const output = await extractor(input, {
        pooling: config.pooling,
        normalize: true,
      })
      return output
        .tolist()
        .map((row) => l2Normalize(Float32Array.from(row)))
    },
  }
}

export function createHfApiEmbedder(
  modelId = resolveEmbedModelId(),
  token = apiKeyFor('HUGGING_FACE_TOKEN'),
): Embedder {
  const config = resolveModelConfig(modelId)
  return {
    id: `hf:${modelId}`,
    dim: config.dim,
    async embed(texts, kind) {
      const prefix = prefixFor(config, kind)
      const res = await fetch(HF_EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: modelId,
          input: texts.map((text) => `${prefix}${text}`),
        }),
      })
      if (!res.ok) {
        throw new Error(`Ошибка HF embeddings (${res.status}): ${await res.text()}`)
      }
      const json = (await res.json()) as { data?: { embedding: number[] }[] }
      const rows = json.data ?? []
      return rows.map((row) => l2Normalize(Float32Array.from(row.embedding)))
    },
  }
}

export function createEmbedder(): Embedder {
  const provider = process.env.RAG_EMBED_PROVIDER?.trim() || 'local'
  return provider === 'hf' ? createHfApiEmbedder() : createLocalEmbedder()
}
