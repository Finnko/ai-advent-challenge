import {
  DEFAULT_RERANK_MARGIN,
  DEFAULT_RERANK_THRESHOLD,
} from '../domain/pipelines'
import type { Reranker } from '../domain/reranker'
import { sigmoid } from '../domain/reranker'

export const DEFAULT_RERANK_MODEL = 'onnx-community/bge-reranker-v2-m3-ONNX'

const BATCH_SIZE = 16

export type RerankDtype = 'q8' | 'fp32' | 'fp16' | 'int8'

export function resolveRerankModelId(): string {
  return process.env.RAG_RERANK_MODEL?.trim() || DEFAULT_RERANK_MODEL
}

export function resolveRerankDtype(): RerankDtype {
  const value = process.env.RAG_RERANK_DTYPE?.trim()
  if (value === 'fp32' || value === 'fp16' || value === 'int8') {
    return value
  }
  return 'q8'
}

export function resolveRerankThreshold(): number {
  const value = process.env.RAG_RERANK_THRESHOLD?.trim()
  if (value === undefined || value === '') {
    return DEFAULT_RERANK_THRESHOLD
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return DEFAULT_RERANK_THRESHOLD
  }
  return parsed
}

export function resolveRerankMargin(): number {
  const value = process.env.RAG_RERANK_MARGIN?.trim()
  if (value === undefined || value === '') {
    return DEFAULT_RERANK_MARGIN
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return DEFAULT_RERANK_MARGIN
  }
  return parsed
}

type CrossEncoderTokenizer = (
  text: string[],
  options: { text_pair: string[]; padding: boolean; truncation: boolean },
) => unknown

type CrossEncoderModel = (
  inputs: unknown,
) => Promise<{ logits: { tolist(): number[][] } }>

type CrossEncoder = {
  tokenizer: CrossEncoderTokenizer
  model: CrossEncoderModel
}

let encoderPromise: Promise<CrossEncoder> | null = null
let encoderKey: string | null = null

async function getCrossEncoder(
  modelId: string,
  dtype: RerankDtype,
): Promise<CrossEncoder> {
  const key = `${modelId}:${dtype}`
  if (!encoderPromise || encoderKey !== key) {
    encoderKey = key
    encoderPromise = (async () => {
      const { AutoModelForSequenceClassification, AutoTokenizer } =
        await import('@huggingface/transformers')
      const tokenizer = await AutoTokenizer.from_pretrained(modelId)
      const model = await AutoModelForSequenceClassification.from_pretrained(
        modelId,
        { dtype },
      )
      return {
        tokenizer: tokenizer as unknown as CrossEncoderTokenizer,
        model: model as unknown as CrossEncoderModel,
      }
    })()
  }
  return encoderPromise
}

export function createLocalReranker(
  modelId = resolveRerankModelId(),
): Reranker {
  const dtype = resolveRerankDtype()
  return {
    id: `local:${modelId}`,
    async rerank({ query, documents }) {
      if (documents.length === 0) {
        return []
      }
      const encoder = await getCrossEncoder(modelId, dtype)
      const scores: number[] = []
      for (let start = 0; start < documents.length; start += BATCH_SIZE) {
        const batch = documents.slice(start, start + BATCH_SIZE)
        const queries = Array.from({ length: batch.length }, () => query)
        const inputs = encoder.tokenizer(queries, {
          text_pair: batch,
          padding: true,
          truncation: true,
        })
        const { logits } = await encoder.model(inputs)
        for (const row of logits.tolist()) {
          scores.push(sigmoid(Number(row[0])))
        }
      }
      return scores
    },
  }
}

export function createReranker(): Reranker {
  return createLocalReranker()
}
