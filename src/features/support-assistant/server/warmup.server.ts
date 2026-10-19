import {
  createEmbedder,
  EmptyIndexError,
  resolveEmbedModelId,
} from '@lib/rag-engine.server'
import { SUPPORT_STRATEGY } from '../domain/constants'
import { assertSupportIndex } from './index.server'
import { getSupportStore } from './store.server'

export type SupportHealth = {
  ok: boolean
  ready: boolean
  warming: boolean
  error: string | null
  index: {
    documents: number
    chunks: number
    model: string | null
    builtAt: string | null
    dim: number
    embedModel: string
    modelOk: boolean
  }
}

type Warmth = {
  ready: boolean
  warming: boolean
  error: string | null
}

const warmth: Warmth = {
  ready: false,
  warming: false,
  error: null,
}

let warmUp: Promise<void> | null = null

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function supportWarmth(): Warmth {
  return { ...warmth }
}

export function warmUpSupport(): Promise<void> {
  if (!warmUp) {
    warmUp = runWarmUp().catch((error) => {
      warmUp = null
      throw error
    })
  }
  return warmUp
}

async function runWarmUp(): Promise<void> {
  warmth.warming = true
  try {
    const store = await getSupportStore()
    assertSupportIndex(store)
    const embedder = createEmbedder()
    await embedder.embed(['прогрев поддержки Ozon'], 'query')
    warmth.ready = true
    warmth.error = null
  } catch (error) {
    warmth.error = messageOf(error)
    throw error
  } finally {
    warmth.warming = false
  }
}

export async function getSupportHealth(): Promise<SupportHealth> {
  try {
    const store = await getSupportStore()
    const embedder = createEmbedder()
    const model = store.getMeta(`${SUPPORT_STRATEGY}.model`)
    const dim = Number(store.getMeta(`${SUPPORT_STRATEGY}.dim`) ?? 0)
    const index = {
      documents: store.listDocuments().length,
      chunks: store.countChunks(SUPPORT_STRATEGY),
      model,
      builtAt: store.getMeta(`${SUPPORT_STRATEGY}.built_at`),
      dim,
      embedModel: resolveEmbedModelId(),
      modelOk: model === embedder.id && dim === embedder.dim,
    }
    const ok = index.chunks > 0 && index.modelOk
    return {
      ok,
      ready: ok && warmth.ready,
      warming: warmth.warming,
      error: warmth.error,
      index,
    }
  } catch (error) {
    return {
      ok: false,
      ready: false,
      warming: warmth.warming,
      error: messageOf(error),
      index: {
        documents: 0,
        chunks: 0,
        model: null,
        builtAt: null,
        dim: 0,
        embedModel: resolveEmbedModelId(),
        modelOk: false,
      },
    }
  }
}

export function isEmptyIndexError(error: unknown): boolean {
  return error instanceof EmptyIndexError
}
